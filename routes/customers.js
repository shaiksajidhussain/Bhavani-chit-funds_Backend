const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { customerValidations, commonValidations, handleValidationErrors } = require('../middleware/validation');
const { authenticateToken, requireAgentOrAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all customers with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
      schemeId,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (schemeId) {
      where.schemeId = schemeId;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.customer.count({ where });

    // Get customers
    const customers = await prisma.customer.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        scheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true,
            dailyPayment: true
          }
        },
        _count: {
          select: {
            collections: true,
            passbookEntries: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        customers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customers',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single customer by ID
router.get('/:id', authenticateToken, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        scheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true,
            dailyPayment: true,
            status: true
          }
        },
        collections: {
          select: {
            id: true,
            amountPaid: true,
            date: true,
            paymentMethod: true,
            remarks: true,
            collector: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { date: 'desc' },
          take: 10
        },
        passbookEntries: {
          select: {
            id: true,
            month: true,
            date: true,
            dailyPayment: true,
            amount: true,
            chittiAmount: true,
            type: true
          },
          orderBy: { date: 'desc' },
          take: 20
        },
        _count: {
          select: {
            collections: true,
            passbookEntries: true
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    res.json({
      success: true,
      data: { customer }
    });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new customer
router.post('/', authenticateToken, requireAgentOrAdmin, customerValidations.create, handleValidationErrors, async (req, res) => {
  try {
    const {
      name,
      mobile,
      address,
      schemeId,
      startDate,
      lastDate,
      amountPerDay,
      duration,
      durationType = 'MONTHS',
      photo,
      status = 'ACTIVE',
      documents = []
    } = req.body;

    // Verify scheme exists
    const scheme = await prisma.chitScheme.findUnique({
      where: { id: schemeId }
    });

    if (!scheme) {
      return res.status(400).json({
        success: false,
        message: 'Chit scheme not found'
      });
    }

    // Check if scheme has capacity
    if (scheme.membersEnrolled >= scheme.numberOfMembers) {
      return res.status(400).json({
        success: false,
        message: 'Chit scheme is full'
      });
    }

    // Calculate initial balance
    const totalAmount = amountPerDay * duration;
    const balance = totalAmount;

    const customer = await prisma.customer.create({
      data: {
        name,
        mobile,
        address,
        schemeId,
        startDate: new Date(startDate),
        lastDate: lastDate ? new Date(lastDate) : null,
        amountPerDay,
        duration,
        durationType,
        photo,
        status,
        documents,
        balance
      },
      include: {
        scheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true,
            dailyPayment: true
          }
        }
      }
    });

    // Update scheme members enrolled count
    await prisma.chitScheme.update({
      where: { id: schemeId },
      data: {
        membersEnrolled: {
          increment: 1
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Customer created successfully',
      data: { customer }
    });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create customer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update customer
router.put('/:id', authenticateToken, requireAgentOrAdmin, commonValidations.id, customerValidations.update, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('Received update request for customer ID:', id);
    console.log('Update data received:', updateData);
    console.log('Update data keys:', Object.keys(updateData));

    // Manual validation for required fields
    if (updateData.schemeId && typeof updateData.schemeId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'schemeId must be a string'
      });
    }

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // If changing scheme, verify new scheme exists and has capacity
    if (updateData.schemeId && updateData.schemeId !== existingCustomer.schemeId) {
      const newScheme = await prisma.chitScheme.findUnique({
        where: { id: updateData.schemeId }
      });

      if (!newScheme) {
        return res.status(400).json({
          success: false,
          message: 'New chit scheme not found'
        });
      }

      if (newScheme.membersEnrolled >= newScheme.numberOfMembers) {
        return res.status(400).json({
          success: false,
          message: 'New chit scheme is full'
        });
      }

      // Update old scheme count
      await prisma.chitScheme.update({
        where: { id: existingCustomer.schemeId },
        data: {
          membersEnrolled: {
            decrement: 1
          }
        }
      });

      // Update new scheme count
      await prisma.chitScheme.update({
        where: { id: updateData.schemeId },
        data: {
          membersEnrolled: {
            increment: 1
          }
        }
      });
    }

    // Convert date strings to Date objects
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.lastDate) {
      updateData.lastDate = new Date(updateData.lastDate);
    }

    // Recalculate balance if amount or duration changes
    if (updateData.amountPerDay || updateData.duration) {
      const amountPerDay = updateData.amountPerDay || existingCustomer.amountPerDay;
      const duration = updateData.duration || existingCustomer.duration;
      const totalAmount = amountPerDay * duration;
      const paidAmount = totalAmount - existingCustomer.balance;
      updateData.balance = totalAmount - paidAmount;
    }

    console.log('Updating customer with data:', updateData);
    console.log('Customer ID:', id);
    console.log('Data fields being sent to Prisma:', Object.keys(updateData));
    
    // Filter out any undefined or null values that might cause issues
    const cleanUpdateData = Object.fromEntries(
      Object.entries(updateData).filter(([key, value]) => value !== undefined && value !== null)
    );
    
    console.log('Clean update data:', cleanUpdateData);
    
    const updatedCustomer = await prisma.customer.update({
      where: { id },
      data: cleanUpdateData,
      include: {
        scheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true,
            dailyPayment: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Customer updated successfully',
      data: { customer: updatedCustomer }
    });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update customer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete customer
router.delete('/:id', authenticateToken, requireAgentOrAdmin, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const existingCustomer = await prisma.customer.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            collections: true,
            passbookEntries: true
          }
        }
      }
    });

    if (!existingCustomer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer has collections or passbook entries
    if (existingCustomer._count.collections > 0 || existingCustomer._count.passbookEntries > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete customer with existing collections or passbook entries'
      });
    }

    // Delete customer
    await prisma.customer.delete({
      where: { id }
    });

    // Update scheme members enrolled count
    await prisma.chitScheme.update({
      where: { id: existingCustomer.schemeId },
      data: {
        membersEnrolled: {
          decrement: 1
        }
      }
    });

    res.json({
      success: true,
      message: 'Customer deleted successfully'
    });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete customer',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get customer statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const { schemeId } = req.query;

    const where = {};
    if (schemeId) where.schemeId = schemeId;

    const [
      totalCustomers,
      activeCustomers,
      completedCustomers,
      defaultedCustomers,
      totalBalance,
      totalCollected
    ] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.count({ where: { ...where, status: 'ACTIVE' } }),
      prisma.customer.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.customer.count({ where: { ...where, status: 'DEFAULTED' } }),
      prisma.customer.aggregate({
        where,
        _sum: { balance: true }
      }),
      prisma.customer.aggregate({
        where,
        _sum: { amountPerDay: true }
      })
    ]);

    const stats = {
      totalCustomers,
      activeCustomers,
      completedCustomers,
      defaultedCustomers,
      totalBalance: totalBalance._sum.balance || 0,
      totalCollected: totalCollected._sum.amountPerDay || 0
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get customer stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
