const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { passbookValidations, commonValidations, handleValidationErrors } = require('../middleware/validation');
const { authenticateToken, requireAgentOrAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get passbook entries for a customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;
    const { 
      page = 1, 
      limit = 20,
      type,
      month,
      year,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
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

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Build where clause
    const where = { customerId };
    
    if (type) {
      where.type = type;
    }
    
    if (month) {
      where.month = parseInt(month);
    }
    
    if (year) {
      const startDate = new Date(year, 0, 1);
      const endDate = new Date(year, 11, 31, 23, 59, 59);
      where.date = {
        gte: startDate,
        lte: endDate
      };
    }

    // Get total count
    const totalCount = await prisma.passbookEntry.count({ where });

    // Get passbook entries
    const entries = await prisma.passbookEntry.findMany({
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
            group: true,
            status: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        customer,
        entries: entries,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get passbook entries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch passbook entries',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new passbook entry
router.post('/', authenticateToken, requireAgentOrAdmin, passbookValidations.create, handleValidationErrors, async (req, res) => {
  try {
    const {
      customerId,
      month,
      date,
      dailyPayment,
      amount,
      chittiAmount,
      type = 'MANUAL'
    } = req.body;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId }
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Check if entry already exists for this month
    const existingEntry = await prisma.passbookEntry.findFirst({
      where: {
        customerId,
        month: parseInt(month),
        type: 'MANUAL'
      }
    });

    if (existingEntry) {
      return res.status(400).json({
        success: false,
        message: 'Manual entry already exists for this month'
      });
    }

    const entry = await prisma.passbookEntry.create({
      data: {
        customerId,
        month: parseInt(month),
        date: new Date(date),
        dailyPayment,
        amount,
        chittiAmount,
        type
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            group: true,
            status: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Passbook entry created successfully',
      data: { entry }
    });
  } catch (error) {
    console.error('Create passbook entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create passbook entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update passbook entry
router.put('/:id', authenticateToken, requireAgentOrAdmin, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if entry exists
    const existingEntry = await prisma.passbookEntry.findUnique({
      where: { id }
    });

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: 'Passbook entry not found'
      });
    }

    // Only allow updating manual entries
    if (existingEntry.type === 'GENERATED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot update generated entries'
      });
    }

    const updatedEntry = await prisma.passbookEntry.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            group: true,
            status: true
          }
        }
      }
    });

    res.json({
      success: true,
      message: 'Passbook entry updated successfully',
      data: { entry: updatedEntry }
    });
  } catch (error) {
    console.error('Update passbook entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update passbook entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete passbook entry
router.delete('/:id', authenticateToken, requireAgentOrAdmin, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if entry exists
    const existingEntry = await prisma.passbookEntry.findUnique({
      where: { id }
    });

    if (!existingEntry) {
      return res.status(404).json({
        success: false,
        message: 'Passbook entry not found'
      });
    }

    // Only allow deleting manual entries
    if (existingEntry.type === 'GENERATED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete generated entries'
      });
    }

    await prisma.passbookEntry.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Passbook entry deleted successfully'
    });
  } catch (error) {
    console.error('Delete passbook entry error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete passbook entry',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get passbook summary for a customer
router.get('/customer/:customerId/summary', authenticateToken, async (req, res) => {
  try {
    const { customerId } = req.params;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
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

    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Get passbook statistics
    const [
      totalEntries,
      manualEntries,
      generatedEntries,
      totalPaid,
      totalChittiAmount
    ] = await Promise.all([
      prisma.passbookEntry.count({
        where: { customerId }
      }),
      prisma.passbookEntry.count({
        where: { customerId, type: 'MANUAL' }
      }),
      prisma.passbookEntry.count({
        where: { customerId, type: 'GENERATED' }
      }),
      prisma.passbookEntry.aggregate({
        where: { customerId },
        _sum: { amount: true }
      }),
      prisma.passbookEntry.aggregate({
        where: { customerId },
        _sum: { chittiAmount: true }
      })
    ]);

    const summary = {
      customer,
      totalEntries,
      manualEntries,
      generatedEntries,
      totalPaid: totalPaid._sum.amount || 0,
      totalChittiAmount: totalChittiAmount._sum.chittiAmount || 0,
      remainingBalance: customer.balance,
      totalAmount: customer.amountPerDay * customer.duration,
      progressPercentage: Math.round(((customer.amountPerDay * customer.duration - customer.balance) / (customer.amountPerDay * customer.duration)) * 100)
    };

    res.json({
      success: true,
      data: { summary }
    });
  } catch (error) {
    console.error('Get passbook summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch passbook summary',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});



module.exports = router;
