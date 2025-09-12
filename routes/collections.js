const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { collectionValidations, commonValidations, handleValidationErrors } = require('../middleware/validation');
const { authenticateToken, requireCollectorOrAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all collections with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      date,
      customerId,
      collectorId,
      paymentMethod,
      search,
      sortBy = 'date',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setDate(endDate.getDate() + 1);
      where.date = {
        gte: startDate,
        lt: endDate
      };
    }
    
    if (customerId) {
      where.customerId = customerId;
    }
    
    if (collectorId) {
      where.collectorId = collectorId;
    }
    
    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }
    
    if (search) {
      where.OR = [
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { mobile: { contains: search, mode: 'insensitive' } } },
        { remarks: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.collection.count({ where });

    // Get collections
    const collections = await prisma.collection.findMany({
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
            scheme: {
              select: {
                id: true,
                name: true,
                dailyPayment: true
              }
            }
          }
        },
        collector: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: {
        collections,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get collections error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collections',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single collection by ID
router.get('/:id', authenticateToken, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    const collection = await prisma.collection.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            address: true,
            group: true,
            status: true,
            scheme: {
              select: {
                id: true,
                name: true,
                chitValue: true,
                dailyPayment: true
              }
            }
          }
        },
        collector: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!collection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    res.json({
      success: true,
      data: { collection }
    });
  } catch (error) {
    console.error('Get collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collection',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new collection
router.post('/', authenticateToken, requireCollectorOrAdmin, collectionValidations.create, handleValidationErrors, async (req, res) => {
  try {
    const {
      customerId,
      amountPaid,
      date,
      balanceRemaining,
      paymentMethod,
      remarks
    } = req.body;

    // Verify customer exists
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        scheme: {
          select: {
            id: true,
            name: true,
            dailyPayment: true
          }
        }
      }
    });

    if (!customer) {
      return res.status(400).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Create collection
    const collection = await prisma.collection.create({
      data: {
        customerId,
        amountPaid,
        collectorId: req.user.id,
        date: new Date(date),
        balanceRemaining,
        paymentMethod,
        remarks
      },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            group: true,
            scheme: {
              select: {
                id: true,
                name: true,
                dailyPayment: true
              }
            }
          }
        },
        collector: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Update customer balance
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        balance: balanceRemaining
      }
    });

    res.status(201).json({
      success: true,
      message: 'Collection recorded successfully',
      data: { collection }
    });
  } catch (error) {
    console.error('Create collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to record collection',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update collection
router.put('/:id', authenticateToken, requireCollectorOrAdmin, commonValidations.id, collectionValidations.update, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if collection exists
    const existingCollection = await prisma.collection.findUnique({
      where: { id },
      include: {
        customer: true
      }
    });

    if (!existingCollection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Update collection
    const updatedCollection = await prisma.collection.update({
      where: { id },
      data: updateData,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true,
            group: true,
            scheme: {
              select: {
                id: true,
                name: true,
                dailyPayment: true
              }
            }
          }
        },
        collector: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Update customer balance if balance remaining changed
    if (updateData.balanceRemaining !== undefined) {
      await prisma.customer.update({
        where: { id: existingCollection.customerId },
        data: {
          balance: updateData.balanceRemaining
        }
      });
    }

    res.json({
      success: true,
      message: 'Collection updated successfully',
      data: { collection: updatedCollection }
    });
  } catch (error) {
    console.error('Update collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update collection',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete collection
router.delete('/:id', authenticateToken, requireCollectorOrAdmin, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if collection exists
    const existingCollection = await prisma.collection.findUnique({
      where: { id },
      include: {
        customer: true
      }
    });

    if (!existingCollection) {
      return res.status(404).json({
        success: false,
        message: 'Collection not found'
      });
    }

    // Delete collection
    await prisma.collection.delete({
      where: { id }
    });

    // Restore customer balance
    const newBalance = existingCollection.customer.balance + existingCollection.amountPaid;
    await prisma.customer.update({
      where: { id: existingCollection.customerId },
      data: {
        balance: newBalance
      }
    });

    res.json({
      success: true,
      message: 'Collection deleted successfully'
    });
  } catch (error) {
    console.error('Delete collection error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete collection',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get daily collection summary
router.get('/stats/daily', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const startDate = new Date(targetDate);
    startDate.setHours(0, 0, 0, 0);
    const endDate = new Date(targetDate);
    endDate.setHours(23, 59, 59, 999);

    const [
      totalCollected,
      paidMembers,
      pendingMembers,
      totalMembers,
      collectionsByMethod
    ] = await Promise.all([
      prisma.collection.aggregate({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amountPaid: true }
      }),
      prisma.collection.count({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          },
          amountPaid: { gt: 0 }
        }
      }),
      prisma.collection.count({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          },
          amountPaid: 0
        }
      }),
      prisma.collection.count({
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        }
      }),
      prisma.collection.groupBy({
        by: ['paymentMethod'],
        where: {
          date: {
            gte: startDate,
            lte: endDate
          }
        },
        _sum: { amountPaid: true },
        _count: { id: true }
      })
    ]);

    const stats = {
      totalCollected: totalCollected._sum.amountPaid || 0,
      paidMembers,
      pendingMembers,
      totalMembers,
      collectionsByMethod: collectionsByMethod.map(item => ({
        method: item.paymentMethod,
        amount: item._sum.amountPaid || 0,
        count: item._count.id
      }))
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get daily collection stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch daily collection statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get collection statistics by date range
router.get('/stats/range', authenticateToken, async (req, res) => {
  try {
    const { startDate, endDate, groupBy = 'day' } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const collections = await prisma.collection.findMany({
      where: {
        date: {
          gte: start,
          lte: end
        }
      },
      select: {
        date: true,
        amountPaid: true,
        paymentMethod: true,
        customer: {
          select: {
            group: true
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Group by day, week, or month
    const groupedData = {};
    collections.forEach(collection => {
      let key;
      const date = new Date(collection.date);
      
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (groupBy === 'month') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!groupedData[key]) {
        groupedData[key] = {
          date: key,
          totalCollected: 0,
          totalCollections: 0,
          byMethod: {},
          byGroup: {}
        };
      }

      groupedData[key].totalCollected += collection.amountPaid;
      groupedData[key].totalCollections += 1;
      
      // Group by payment method
      if (!groupedData[key].byMethod[collection.paymentMethod]) {
        groupedData[key].byMethod[collection.paymentMethod] = { amount: 0, count: 0 };
      }
      groupedData[key].byMethod[collection.paymentMethod].amount += collection.amountPaid;
      groupedData[key].byMethod[collection.paymentMethod].count += 1;
      
      // Group by customer group
      if (!groupedData[key].byGroup[collection.customer.group]) {
        groupedData[key].byGroup[collection.customer.group] = { amount: 0, count: 0 };
      }
      groupedData[key].byGroup[collection.customer.group].amount += collection.amountPaid;
      groupedData[key].byGroup[collection.customer.group].count += 1;
    });

    const stats = Object.values(groupedData);

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get collection range stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collection range statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
