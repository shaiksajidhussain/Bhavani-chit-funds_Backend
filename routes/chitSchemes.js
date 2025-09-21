const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { chitSchemeValidations, commonValidations, handleValidationErrors } = require('../middleware/validation');
const { authenticateToken, requireAgentOrAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all chit schemes with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status, 
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
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { auctionRules: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.chitScheme.count({ where });

    // Get schemes
    const schemes = await prisma.chitScheme.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        _count: {
          select: {
            customerSchemes: true,
            auctions: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        schemes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get chit schemes error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chit schemes',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single chit scheme by ID
router.get('/:id', authenticateToken, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    const scheme = await prisma.chitScheme.findUnique({
      where: { id },
      include: {
        customerSchemes: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                mobile: true,
                status: true
              }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        auctions: {
          select: {
            id: true,
            auctionDate: true,
            status: true,
            amountReceived: true,
            winningMember: {
              select: {
                id: true,
                name: true
              }
            }
          },
          orderBy: { auctionDate: 'desc' }
        },
        _count: {
          select: {
            customerSchemes: true,
            auctions: true
          }
        }
      }
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Chit scheme not found'
      });
    }

    res.json({
      success: true,
      data: { scheme }
    });
  } catch (error) {
    console.error('Get chit scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch chit scheme',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new chit scheme
router.post('/', authenticateToken, requireAgentOrAdmin, chitSchemeValidations.create, handleValidationErrors, async (req, res) => {
  try {
    const {
      name,
      chitValue,
      duration,
      durationType,
      paymentType = 'DAILY',
      dailyPayment,
      monthlyPayment,
      numberOfMembers,
      auctionRules,
      startDate,
      lastDate,
      status = 'ACTIVE',
      description,
      commissionRate,
      penaltyRate,
      minBidAmount,
      maxBidAmount,
      isActive = true
    } = req.body;

    // Calculate end date
    const start = new Date(startDate);
    let endDate;
    
    if (durationType === 'MONTHS') {
      endDate = new Date(start);
      endDate.setMonth(start.getMonth() + duration);
    } else {
      endDate = new Date(start);
      endDate.setDate(start.getDate() + duration);
    }

    const scheme = await prisma.chitScheme.create({
      data: {
        name,
        chitValue,
        duration,
        durationType,
        paymentType,
        dailyPayment,
        monthlyPayment,
        numberOfMembers,
        auctionRules,
        startDate: new Date(startDate),
        endDate,
        lastDate: lastDate ? new Date(lastDate) : null,
        status,
        description,
        commissionRate,
        penaltyRate,
        minBidAmount,
        maxBidAmount,
        isActive,
        createdBy: req.user.id
      }
    });

    res.status(201).json({
      success: true,
      message: 'Chit scheme created successfully',
      data: { scheme }
    });
  } catch (error) {
    console.error('Create chit scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create chit scheme',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update chit scheme
router.put('/:id', authenticateToken, requireAgentOrAdmin, commonValidations.id, chitSchemeValidations.update, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if scheme exists
    const existingScheme = await prisma.chitScheme.findUnique({
      where: { id }
    });

    if (!existingScheme) {
      return res.status(404).json({
        success: false,
        message: 'Chit scheme not found'
      });
    }

    // Convert date strings to Date objects
    if (updateData.startDate) {
      updateData.startDate = new Date(updateData.startDate);
    }
    if (updateData.lastDate) {
      updateData.lastDate = new Date(updateData.lastDate);
    }

    // Recalculate end date if duration or start date is being updated
    if (updateData.startDate || updateData.duration || updateData.durationType) {
      const startDate = updateData.startDate ? new Date(updateData.startDate) : existingScheme.startDate;
      const duration = updateData.duration || existingScheme.duration;
      const durationType = updateData.durationType || existingScheme.durationType;

      let endDate;
      if (durationType === 'MONTHS') {
        endDate = new Date(startDate);
        endDate.setMonth(startDate.getMonth() + duration);
      } else {
        endDate = new Date(startDate);
        endDate.setDate(startDate.getDate() + duration);
      }
      updateData.endDate = endDate;
    }

    const updatedScheme = await prisma.chitScheme.update({
      where: { id },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Chit scheme updated successfully',
      data: { scheme: updatedScheme }
    });
  } catch (error) {
    console.error('Update chit scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update chit scheme',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete chit scheme
router.delete('/:id', authenticateToken, requireAgentOrAdmin, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if scheme exists
    const existingScheme = await prisma.chitScheme.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            customerSchemes: true,
            auctions: true
          }
        }
      }
    });

    if (!existingScheme) {
      return res.status(404).json({
        success: false,
        message: 'Chit scheme not found'
      });
    }

    // Check if scheme has customers or auctions
    if (existingScheme._count.customerSchemes > 0 || existingScheme._count.auctions > 0) {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete chit scheme with existing customers or auctions'
      });
    }

    await prisma.chitScheme.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Chit scheme deleted successfully'
    });
  } catch (error) {
    console.error('Delete chit scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete chit scheme',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get scheme members
router.get('/:id/members', authenticateToken, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const { 
      page = 1, 
      limit = 50,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Verify scheme exists
    const scheme = await prisma.chitScheme.findUnique({
      where: { id },
      select: { id: true, name: true }
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Chit scheme not found'
      });
    }

    // Build where clause for customers
    const where = { schemeId: id };
    
    if (status) {
      where.status = status;
    }
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { mobile: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.customerScheme.count({ where });

    // Get customer schemes
    const customerSchemes = await prisma.customerScheme.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            address: true,
            photo: true,
            createdAt: true,
            _count: {
              select: {
                collections: true
              }
            }
          }
        }
      }
    });

    // Calculate member statistics
    const allCustomerSchemes = await prisma.customerScheme.findMany({
      where: { schemeId: id },
      select: { status: true, balance: true, amountPerDay: true, duration: true }
    });

    const stats = {
      totalMembers: allCustomerSchemes.length,
      activeMembers: allCustomerSchemes.filter(cs => cs.status === 'ACTIVE').length,
      completedMembers: allCustomerSchemes.filter(cs => cs.status === 'COMPLETED').length,
      defaultedMembers: allCustomerSchemes.filter(cs => cs.status === 'DEFAULTED').length,
      totalBalance: allCustomerSchemes.reduce((sum, cs) => sum + cs.balance, 0),
      totalAmountPaid: allCustomerSchemes.reduce((sum, cs) => sum + (cs.amountPerDay * cs.duration - cs.balance), 0)
    };

    // Format the response to match the expected structure
    const members = customerSchemes.map(cs => ({
      ...cs.customer,
      status: cs.status,
      startDate: cs.startDate,
      lastDate: cs.lastDate,
      amountPerDay: cs.amountPerDay,
      duration: cs.duration,
      durationType: cs.durationType,
      balance: cs.balance
    }));

    res.json({
      success: true,
      data: {
        scheme: {
          id: scheme.id,
          name: scheme.name
        },
        members: members,
        stats,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get scheme members error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheme members',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Add existing customer to scheme
router.post('/:id/members', authenticateToken, requireAgentOrAdmin, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id: schemeId } = req.params;
    const { customerId, amountPerDay, duration, durationType = 'MONTHS', startDate, lastDate } = req.body;

    // Verify scheme exists
    const scheme = await prisma.chitScheme.findUnique({
      where: { id: schemeId }
    });

    if (!scheme) {
      return res.status(404).json({
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

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if customer is already in this scheme
    const existingCustomerScheme = await prisma.customerScheme.findFirst({
      where: {
        customerId,
        schemeId
      }
    });

    if (existingCustomerScheme) {
      return res.status(400).json({
        success: false,
        message: 'Customer is already enrolled in this scheme'
      });
    }

    // Calculate initial balance
    const totalAmount = amountPerDay * duration;
    const balance = totalAmount;

    // Create customer scheme relationship
    const customerScheme = await prisma.customerScheme.create({
      data: {
        customerId,
        schemeId,
        amountPerDay,
        duration,
        durationType,
        startDate: startDate ? new Date(startDate) : customer.startDate,
        lastDate: lastDate ? new Date(lastDate) : null,
        balance
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            address: true,
            status: true
          }
        },
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
      message: 'Customer added to scheme successfully',
      data: { customerScheme }
    });
  } catch (error) {
    console.error('Add customer to scheme error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add customer to scheme',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get scheme statistics
router.get('/:id/stats', authenticateToken, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    const scheme = await prisma.chitScheme.findUnique({
      where: { id },
      include: {
        customerSchemes: {
          select: {
            status: true,
            balance: true,
            amountPerDay: true
          }
        },
        auctions: {
          select: {
            status: true,
            amountReceived: true,
            discountAmount: true
          }
        }
      }
    });

    if (!scheme) {
      return res.status(404).json({
        success: false,
        message: 'Chit scheme not found'
      });
    }

    const stats = {
      totalMembers: scheme.customerSchemes.length,
      activeMembers: scheme.customerSchemes.filter(cs => cs.status === 'ACTIVE').length,
      completedMembers: scheme.customerSchemes.filter(cs => cs.status === 'COMPLETED').length,
      defaultedMembers: scheme.customerSchemes.filter(cs => cs.status === 'DEFAULTED').length,
      totalBalance: scheme.customerSchemes.reduce((sum, cs) => sum + cs.balance, 0),
      totalCollected: scheme.customerSchemes.reduce((sum, cs) => sum + (cs.amountPerDay * scheme.duration - cs.balance), 0),
      totalAuctions: scheme.auctions.length,
      completedAuctions: scheme.auctions.filter(a => a.status === 'COMPLETED').length,
      totalAmountReceived: scheme.auctions
        .filter(a => a.status === 'COMPLETED')
        .reduce((sum, a) => sum + a.amountReceived, 0),
      totalDiscount: scheme.auctions
        .filter(a => a.status === 'COMPLETED')
        .reduce((sum, a) => sum + a.discountAmount, 0)
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get scheme stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheme statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
