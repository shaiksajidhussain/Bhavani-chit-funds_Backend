const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticateToken, requireAgentOrAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard overview statistics
router.get('/dashboard/overview', authenticateToken, async (req, res) => {
  try {
    const [
      totalSchemes,
      activeSchemes,
      totalCustomers,
      activeCustomers,
      totalCollections,
      totalAuctions,
      totalRevenue,
      pendingCollections
    ] = await Promise.all([
      prisma.chitScheme.count(),
      prisma.chitScheme.count({ where: { status: 'ACTIVE' } }),
      prisma.customer.count(),
      prisma.customer.count({ where: { status: 'ACTIVE' } }),
      prisma.collection.count(),
      prisma.auction.count(),
      prisma.collection.aggregate({
        _sum: { amountPaid: true }
      }),
      prisma.collection.count({
        where: { amountPaid: 0 }
      })
    ]);

    const overview = {
      schemes: {
        total: totalSchemes,
        active: activeSchemes,
        completed: totalSchemes - activeSchemes
      },
      customers: {
        total: totalCustomers,
        active: activeCustomers,
        completed: totalCustomers - activeCustomers
      },
      collections: {
        total: totalCollections,
        pending: pendingCollections,
        completed: totalCollections - pendingCollections
      },
      auctions: {
        total: totalAuctions
      },
      revenue: {
        total: totalRevenue._sum.amountPaid || 0
      }
    };

    res.json({
      success: true,
      data: { overview }
    });
  } catch (error) {
    console.error('Get dashboard overview error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard overview',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get revenue report
router.get('/revenue', authenticateToken, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate, 
      groupBy = 'day',
      schemeId,
      group
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build where clause
    const where = {
      date: {
        gte: start,
        lte: end
      }
    };

    if (schemeId) {
      where.customer = {
        schemeId: schemeId
      };
    }

    if (group) {
      where.customer = {
        ...where.customer,
        group: group
      };
    }

    const collections = await prisma.collection.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            group: true,
            scheme: {
              select: {
                id: true,
                name: true
              }
            }
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    // Group data by time period
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
          totalRevenue: 0,
          totalCollections: 0,
          byScheme: {},
          byGroup: {},
          byPaymentMethod: {}
        };
      }

      groupedData[key].totalRevenue += collection.amountPaid;
      groupedData[key].totalCollections += 1;

      // Group by scheme
      const schemeName = collection.customer.scheme.name;
      if (!groupedData[key].byScheme[schemeName]) {
        groupedData[key].byScheme[schemeName] = { amount: 0, count: 0 };
      }
      groupedData[key].byScheme[schemeName].amount += collection.amountPaid;
      groupedData[key].byScheme[schemeName].count += 1;

      // Group by customer group
      const customerGroup = collection.customer.group;
      if (!groupedData[key].byGroup[customerGroup]) {
        groupedData[key].byGroup[customerGroup] = { amount: 0, count: 0 };
      }
      groupedData[key].byGroup[customerGroup].amount += collection.amountPaid;
      groupedData[key].byGroup[customerGroup].count += 1;

      // Group by payment method
      const paymentMethod = collection.paymentMethod;
      if (!groupedData[key].byPaymentMethod[paymentMethod]) {
        groupedData[key].byPaymentMethod[paymentMethod] = { amount: 0, count: 0 };
      }
      groupedData[key].byPaymentMethod[paymentMethod].amount += collection.amountPaid;
      groupedData[key].byPaymentMethod[paymentMethod].count += 1;
    });

    const revenueData = Object.values(groupedData);

    res.json({
      success: true,
      data: { revenueData }
    });
  } catch (error) {
    console.error('Get revenue report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get customer performance report
router.get('/customers/performance', authenticateToken, async (req, res) => {
  try {
    const { 
      schemeId,
      group,
      status,
      sortBy = 'totalPaid',
      sortOrder = 'desc'
    } = req.query;

    // Build where clause
    const where = {};
    if (schemeId) where.schemeId = schemeId;
    if (group) where.group = group;
    if (status) where.status = status;

    const customers = await prisma.customer.findMany({
      where,
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
        collections: {
          select: {
            amountPaid: true,
            date: true,
            paymentMethod: true
          }
        },
        _count: {
          select: {
            collections: true
          }
        }
      }
    });

    // Calculate performance metrics
    const performanceData = customers.map(customer => {
      const totalPaid = customer.collections.reduce((sum, collection) => sum + collection.amountPaid, 0);
      const totalAmount = customer.amountPerDay * customer.duration;
      const remainingBalance = customer.balance;
      const progressPercentage = Math.round(((totalAmount - remainingBalance) / totalAmount) * 100);
      const averagePayment = customer.collections.length > 0 ? totalPaid / customer.collections.length : 0;
      
      // Calculate payment consistency
      const paymentDays = customer.collections.filter(c => c.amountPaid > 0).length;
      const expectedDays = Math.ceil((new Date() - new Date(customer.startDate)) / (1000 * 60 * 60 * 24));
      const consistencyPercentage = expectedDays > 0 ? Math.round((paymentDays / expectedDays) * 100) : 0;

      return {
        customer: {
          id: customer.id,
          name: customer.name,
          mobile: customer.mobile,
          group: customer.group,
          status: customer.status,
          startDate: customer.startDate
        },
        scheme: customer.scheme,
        performance: {
          totalPaid,
          remainingBalance,
          totalAmount,
          progressPercentage,
          averagePayment,
          consistencyPercentage,
          totalCollections: customer._count.collections,
          lastPaymentDate: customer.collections.length > 0 
            ? customer.collections.sort((a, b) => new Date(b.date) - new Date(a.date))[0].date
            : null
        }
      };
    });

    // Sort by specified field
    performanceData.sort((a, b) => {
      const aValue = a.performance[sortBy];
      const bValue = b.performance[sortBy];
      return sortOrder === 'asc' ? aValue - bValue : bValue - aValue;
    });

    res.json({
      success: true,
      data: { performanceData }
    });
  } catch (error) {
    console.error('Get customer performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch customer performance report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get scheme performance report
router.get('/schemes/performance', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;

    // Build where clause
    const where = {};
    if (status) where.status = status;

    const schemes = await prisma.chitScheme.findMany({
      where,
      include: {
        customers: {
          select: {
            id: true,
            status: true,
            balance: true,
            amountPerDay: true,
            startDate: true
          }
        },
        auctions: {
          select: {
            id: true,
            status: true,
            amountReceived: true,
            discountAmount: true,
            auctionDate: true
          }
        },
        _count: {
          select: {
            customers: true,
            auctions: true
          }
        }
      }
    });

    // Calculate performance metrics
    const performanceData = schemes.map(scheme => {
      const activeCustomers = scheme.customers.filter(c => c.status === 'ACTIVE').length;
      const completedCustomers = scheme.customers.filter(c => c.status === 'COMPLETED').length;
      const defaultedCustomers = scheme.customers.filter(c => c.status === 'DEFAULTED').length;
      
      const totalBalance = scheme.customers.reduce((sum, c) => sum + c.balance, 0);
      const totalExpected = scheme.customers.reduce((sum, c) => sum + (c.amountPerDay * scheme.duration), 0);
      const totalCollected = totalExpected - totalBalance;
      const collectionRate = totalExpected > 0 ? Math.round((totalCollected / totalExpected) * 100) : 0;
      
      const completedAuctions = scheme.auctions.filter(a => a.status === 'COMPLETED').length;
      const totalAmountReceived = scheme.auctions
        .filter(a => a.status === 'COMPLETED')
        .reduce((sum, a) => sum + a.amountReceived, 0);
      const totalDiscount = scheme.auctions
        .filter(a => a.status === 'COMPLETED')
        .reduce((sum, a) => sum + a.discountAmount, 0);

      return {
        scheme: {
          id: scheme.id,
          name: scheme.name,
          chitValue: scheme.chitValue,
          duration: scheme.duration,
          durationType: scheme.durationType,
          dailyPayment: scheme.dailyPayment,
          status: scheme.status,
          startDate: scheme.startDate,
          endDate: scheme.endDate
        },
        performance: {
          totalMembers: scheme._count.customers,
          activeMembers: activeCustomers,
          completedMembers: completedCustomers,
          defaultedMembers: defaultedCustomers,
          enrollmentRate: scheme.numberOfMembers > 0 ? Math.round((scheme._count.customers / scheme.numberOfMembers) * 100) : 0,
          totalBalance,
          totalCollected,
          collectionRate,
          totalAuctions: scheme._count.auctions,
          completedAuctions,
          totalAmountReceived,
          totalDiscount,
          averageDiscount: completedAuctions > 0 ? Math.round(totalDiscount / completedAuctions) : 0
        }
      };
    });

    res.json({
      success: true,
      data: { performanceData }
    });
  } catch (error) {
    console.error('Get scheme performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch scheme performance report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get collection efficiency report
router.get('/collections/efficiency', authenticateToken, async (req, res) => {
  try {
    const { 
      startDate, 
      endDate,
      collectorId,
      group
    } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    // Build where clause
    const where = {
      date: {
        gte: start,
        lte: end
      }
    };

    if (collectorId) {
      where.collectorId = collectorId;
    }

    if (group) {
      where.customer = {
        group: group
      };
    }

    const collections = await prisma.collection.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
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
            name: true
          }
        }
      }
    });

    // Group by collector
    const collectorStats = {};
    collections.forEach(collection => {
      const collectorId = collection.collector.id;
      const collectorName = collection.collector.name;

      if (!collectorStats[collectorId]) {
        collectorStats[collectorId] = {
          collector: {
            id: collectorId,
            name: collectorName
          },
          totalCollections: 0,
          totalAmount: 0,
          paidCollections: 0,
          pendingCollections: 0,
          efficiency: 0
        };
      }

      collectorStats[collectorId].totalCollections += 1;
      collectorStats[collectorId].totalAmount += collection.amountPaid;
      
      if (collection.amountPaid > 0) {
        collectorStats[collectorId].paidCollections += 1;
      } else {
        collectorStats[collectorId].pendingCollections += 1;
      }
    });

    // Calculate efficiency for each collector
    Object.values(collectorStats).forEach(stats => {
      stats.efficiency = stats.totalCollections > 0 
        ? Math.round((stats.paidCollections / stats.totalCollections) * 100) 
        : 0;
    });

    const efficiencyData = Object.values(collectorStats);

    res.json({
      success: true,
      data: { efficiencyData }
    });
  } catch (error) {
    console.error('Get collection efficiency report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch collection efficiency report',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
