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
      schemeId
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
        schemes: {
          some: {
            schemeId: schemeId
          }
        }
      };
    }


    const collections = await prisma.collection.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            schemes: {
              include: {
                scheme: {
                  select: {
                    id: true,
                    name: true
                  }
                }
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
          byPaymentMethod: {}
        };
      }

      groupedData[key].totalRevenue += collection.amountPaid;
      groupedData[key].totalCollections += 1;

      // Group by scheme (handle multiple schemes per customer)
      collection.customer.schemes.forEach(customerScheme => {
        const schemeName = customerScheme.scheme.name;
        if (!groupedData[key].byScheme[schemeName]) {
          groupedData[key].byScheme[schemeName] = { amount: 0, count: 0 };
        }
        groupedData[key].byScheme[schemeName].amount += collection.amountPaid;
        groupedData[key].byScheme[schemeName].count += 1;
      });

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
      status,
      sortBy = 'totalPaid',
      sortOrder = 'desc'
    } = req.query;

    // Build where clause
    const where = {};
    if (schemeId) {
      where.schemes = {
        some: {
          schemeId: schemeId
        }
      };
    }
    if (status) where.status = status;

    const customers = await prisma.customer.findMany({
      where,
      include: {
        schemes: {
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
          status: customer.status,
          startDate: customer.startDate
        },
        schemes: customer.schemes.map(cs => cs.scheme),
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
        customerSchemes: {
          include: {
            customer: {
              select: {
                id: true,
                status: true,
                balance: true,
                amountPerDay: true,
                startDate: true
              }
            }
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
            customerSchemes: true,
            auctions: true
          }
        }
      }
    });

    // Calculate performance metrics
    const performanceData = schemes.map(scheme => {
      const customers = scheme.customerSchemes.map(cs => cs.customer);
      const activeCustomers = customers.filter(c => c.status === 'ACTIVE').length;
      const completedCustomers = customers.filter(c => c.status === 'COMPLETED').length;
      const defaultedCustomers = customers.filter(c => c.status === 'DEFAULTED').length;
      
      const totalBalance = customers.reduce((sum, c) => sum + c.balance, 0);
      const totalExpected = customers.reduce((sum, c) => sum + (c.amountPerDay * scheme.duration), 0);
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
          totalMembers: scheme._count.customerSchemes,
          activeMembers: activeCustomers,
          completedMembers: completedCustomers,
          defaultedMembers: defaultedCustomers,
          enrollmentRate: scheme.numberOfMembers > 0 ? Math.round((scheme._count.customerSchemes / scheme.numberOfMembers) * 100) : 0,
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
      collectorId
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


    const collections = await prisma.collection.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            schemes: {
              include: {
                scheme: {
                  select: {
                    id: true,
                    name: true,
                    dailyPayment: true
                  }
                }
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

// Get daily report data
router.get('/daily', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
    const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));

    // Get collections for the day
    const dailyCollections = await prisma.collection.findMany({
      where: {
        date: {
          gte: startOfDay,
          lte: endOfDay
        }
      },
      include: {
        customer: true
      }
    });

    const totalCollection = dailyCollections.reduce((sum, collection) => sum + (collection.amountPaid || 0), 0);
    const paidMembers = dailyCollections.filter(c => c.amountPaid > 0).length;
    const pendingMembers = dailyCollections.filter(c => c.amountPaid === 0).length;
    
    // Get defaulters (customers with overdue payments)
    const defaulters = await prisma.customer.count({
      where: {
        status: 'DEFAULTED',
        lastDate: {
          lt: startOfDay
        }
      }
    });

    const totalMembers = paidMembers + pendingMembers;
    const collectionRate = totalMembers > 0 ? ((paidMembers / totalMembers) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        totalCollection,
        paidMembers,
        pendingMembers,
        defaulters,
        collectionRate: parseFloat(collectionRate)
      }
    });
  } catch (error) {
    console.error('Daily report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate daily report',
      error: error.message
    });
  }
});

// Get passbook statistics for profit calculations
router.get('/passbook-stats', authenticateToken, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    // Get start and end of the target date
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all active customers with their schemes
    const activeCustomers = await prisma.customer.findMany({
      where: { status: 'ACTIVE' },
      include: {
        schemes: {
          include: {
            scheme: {
              select: {
                id: true,
                name: true,
                chitValue: true,
                commissionRate: true,
                dailyPayment: true
              }
            }
          }
        }
      }
    });

    // Get actual passbook entries for today and yesterday (to catch any timezone issues)
    const yesterday = new Date(targetDate);
    yesterday.setDate(yesterday.getDate() - 1);
    const startOfYesterday = new Date(yesterday);
    startOfYesterday.setHours(0, 0, 0, 0);
    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const todayPassbookEntries = await prisma.passbookEntry.findMany({
      where: {
        OR: [
          {
            date: {
              gte: startOfDay,
              lte: endOfDay
            }
          },
          {
            date: {
              gte: startOfYesterday,
              lte: endOfYesterday
            }
          }
        ]
        // Include both GENERATED and MANUAL entries
      },
      include: {
        customerScheme: {
          include: {
            customer: {
              select: {
                id: true,
                name: true,
                mobile: true
              }
            },
            scheme: {
              select: {
                id: true,
                name: true,
                commissionRate: true
              }
            }
          }
        }
      }
    });

    // Debug logging
    console.log('Active customers found:', activeCustomers.length);
    console.log('Today passbook entries found:', todayPassbookEntries.length);
    console.log('Looking for entries between:', startOfDay.toISOString(), 'and', endOfDay.toISOString());
    console.log('Also looking for entries between:', startOfYesterday.toISOString(), 'and', endOfYesterday.toISOString());
    
    // Log each passbook entry found
    todayPassbookEntries.forEach((entry, index) => {
      console.log(`Entry ${index + 1}:`, {
        id: entry.id,
        date: entry.date.toISOString(),
        dailyPayment: entry.dailyPayment,
        amount: entry.amount,
        customerId: entry.customerScheme.customer.id,
        customerName: entry.customerScheme.customer.name,
        schemeId: entry.customerScheme.scheme.id,
        schemeName: entry.customerScheme.scheme.name,
        note: `Using amount (${entry.amount}) for calculations, not dailyPayment (${entry.dailyPayment})`
      });
    });
    
    // Calculate expected vs actual payments
    let totalExpectedDaily = 0;
    let totalActualDaily = 0;
    let totalDailyProfits = 0;
    let totalMonthlyProfits = 0;
    let backlogs = [];
    let paidCustomers = [];
    let pendingCustomers = [];

    // Process each active customer
    activeCustomers.forEach(customer => {
      console.log(`\nProcessing customer: ${customer.name} (ID: ${customer.id})`);
      customer.schemes.forEach(customerScheme => {
        const scheme = customerScheme.scheme;
        const expectedDaily = scheme.dailyPayment || 0;
        const commissionRate = scheme.commissionRate || 0.05;
        
        console.log(`  - Scheme: ${scheme.name} (ID: ${scheme.id}), Expected Daily: ${expectedDaily}`);
        
        // Find actual payment for this customer and scheme today
        const actualEntry = todayPassbookEntries.find(entry => 
          entry.customerScheme.customer.id === customer.id && entry.customerScheme.scheme.id === scheme.id
        );
        
        const actualDaily = actualEntry ? actualEntry.amount : 0;
        const backlog = expectedDaily - actualDaily;
        
        console.log(`    - Found entry: ${actualEntry ? 'YES' : 'NO'}, Actual Daily: ${actualDaily}, Backlog: ${backlog}`);
        if (actualEntry) {
          console.log(`    - Entry details: Date: ${actualEntry.date.toISOString()}, DailyPayment: ${actualEntry.dailyPayment}, Amount: ${actualEntry.amount}, Using Amount for calculation: ${actualDaily}`);
        }
        
        // Add to totals
        totalExpectedDaily += expectedDaily;
        totalActualDaily += actualDaily;
        
        // Calculate profits on actual payments
        const dailyProfit = actualDaily * commissionRate;
        totalDailyProfits += dailyProfit;
        
        // Track backlogs
        if (backlog > 0) {
          backlogs.push({
            customerId: customer.id,
            customerName: customer.name,
            customerMobile: customer.mobile,
            schemeId: scheme.id,
            schemeName: scheme.name,
            expectedAmount: expectedDaily,
            actualAmount: actualDaily,
            backlogAmount: backlog,
            commissionRate: commissionRate
          });
        }
        
        // Track paid customers
        if (actualDaily > 0) {
          paidCustomers.push({
            customerId: customer.id,
            customerName: customer.name,
            customerMobile: customer.mobile,
            schemeId: scheme.id,
            schemeName: scheme.name,
            expectedAmount: expectedDaily,
            actualAmount: actualDaily,
            commissionRate: commissionRate
          });
        } else {
          pendingCustomers.push({
            customerId: customer.id,
            customerName: customer.name,
            customerMobile: customer.mobile,
            schemeId: scheme.id,
            schemeName: scheme.name,
            expectedAmount: expectedDaily,
            actualAmount: 0,
            commissionRate: commissionRate
          });
        }
      });
    });

    // Calculate monthly profits
    const daysInCurrentMonth = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    totalMonthlyProfits = totalDailyProfits * daysInCurrentMonth;

    // Calculate collection rate
    const collectionRate = totalExpectedDaily > 0 ? ((totalActualDaily / totalExpectedDaily) * 100).toFixed(2) : 0;

    // Debug logging for totals
    console.log('Total Expected Daily:', totalExpectedDaily);
    console.log('Total Actual Daily:', totalActualDaily);
    console.log('Total Daily Profits:', totalDailyProfits);
    console.log('Collection Rate:', collectionRate);

    const stats = {
      date: targetDate.toISOString().split('T')[0],
      totals: {
        expectedDaily: totalExpectedDaily,
        actualDaily: totalActualDaily,
        dailyProfits: totalDailyProfits,
        monthlyProfits: totalMonthlyProfits,
        collectionRate: parseFloat(collectionRate),
        daysInMonth: daysInCurrentMonth
      },
      breakdown: {
        paidCustomers: paidCustomers,
        pendingCustomers: pendingCustomers,
        backlogs: backlogs
      },
      summary: {
        totalCustomers: activeCustomers.length,
        paidCount: paidCustomers.length,
        pendingCount: pendingCustomers.length,
        backlogCount: backlogs.length,
        totalBacklogAmount: backlogs.reduce((sum, b) => sum + b.backlogAmount, 0)
      }
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get passbook stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch passbook statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get recent activities for dashboard
router.get('/recent-activities', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const take = parseInt(limit);

    // Get recent collections
    const recentCollections = await prisma.collection.findMany({
      take: Math.ceil(take / 2),
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            mobile: true
          }
        }
      }
    });

    // Get recent auctions
    const recentAuctions = await prisma.auction.findMany({
      take: Math.ceil(take / 2),
      orderBy: { createdAt: 'desc' },
      include: {
        chitScheme: {
          select: {
            id: true,
            name: true,
            chitValue: true
          }
        },
        winningMember: {
          select: {
            id: true,
            name: true,
            mobile: true
          }
        }
      }
    });

    // Get recent customer registrations
    const recentCustomers = await prisma.customer.findMany({
      take: Math.ceil(take / 3),
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        mobile: true,
        status: true,
        createdAt: true
      }
    });

    // Combine and format activities
    const activities = [];

    // Add collections
    recentCollections.forEach(collection => {
      activities.push({
        id: `collection-${collection.id}`,
        type: 'collection',
        title: 'Collection Recorded',
        description: `₹${collection.amountPaid.toLocaleString()} collected from ${collection.customer.name}`,
        customer: collection.customer,
        amount: collection.amountPaid,
        date: collection.createdAt,
        icon: '💰',
        color: 'green'
      });
    });

    // Add auctions
    recentAuctions.forEach(auction => {
      activities.push({
        id: `auction-${auction.id}`,
        type: 'auction',
        title: 'Auction Conducted',
        description: auction.winningMember 
          ? `Auction won by ${auction.winningMember.name} for ₹${auction.amountReceived.toLocaleString()}`
          : `Auction scheduled for ${auction.chitScheme.name}`,
        customer: auction.winningMember,
        amount: auction.amountReceived,
        date: auction.createdAt,
        icon: '🔨',
        color: 'blue'
      });
    });

    // Add customer registrations
    recentCustomers.forEach(customer => {
      activities.push({
        id: `customer-${customer.id}`,
        type: 'registration',
        title: 'New Customer Registered',
        description: `${customer.name} joined the system`,
        customer: customer,
        amount: 0,
        date: customer.createdAt,
        icon: '👤',
        color: 'purple'
      });
    });

    // Sort by date and limit
    activities.sort((a, b) => new Date(b.date) - new Date(a.date));
    const limitedActivities = activities.slice(0, take);

    res.json({
      success: true,
      data: { activities: limitedActivities }
    });
  } catch (error) {
    console.error('Get recent activities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent activities',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get monthly report data
router.get('/monthly', authenticateToken, async (req, res) => {
  try {
    const { year, month } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    const targetMonth = month ? parseInt(month) - 1 : new Date().getMonth();
    
    const startOfMonth = new Date(targetYear, targetMonth, 1);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);

    // Get collections for the month
    const monthlyCollections = await prisma.collection.findMany({
      where: {
        date: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      },
      include: {
        customer: true
      }
    });

    const totalCollection = monthlyCollections.reduce((sum, collection) => sum + (collection.amountPaid || 0), 0);
    const paidMembers = monthlyCollections.filter(c => c.amountPaid > 0).length;
    const pendingMembers = monthlyCollections.filter(c => c.amountPaid === 0).length;
    
    // Get defaulters for the month
    const defaulters = await prisma.customer.count({
      where: {
        status: 'DEFAULTED',
        lastDate: {
          gte: startOfMonth,
          lte: endOfMonth
        }
      }
    });

    const totalMembers = paidMembers + pendingMembers;
    const collectionRate = totalMembers > 0 ? ((paidMembers / totalMembers) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        totalCollection,
        paidMembers,
        pendingMembers,
        defaulters,
        collectionRate: parseFloat(collectionRate)
      }
    });
  } catch (error) {
    console.error('Monthly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate monthly report',
      error: error.message
    });
  }
});

// Get yearly report data
router.get('/yearly', authenticateToken, async (req, res) => {
  try {
    const { year } = req.query;
    const targetYear = year ? parseInt(year) : new Date().getFullYear();
    
    const startOfYear = new Date(targetYear, 0, 1);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);

    // Get collections for the year
    const yearlyCollections = await prisma.collection.findMany({
      where: {
        date: {
          gte: startOfYear,
          lte: endOfYear
        }
      },
      include: {
        customer: true
      }
    });

    const totalCollection = yearlyCollections.reduce((sum, collection) => sum + (collection.amountPaid || 0), 0);
    const paidMembers = yearlyCollections.filter(c => c.amountPaid > 0).length;
    const pendingMembers = yearlyCollections.filter(c => c.amountPaid === 0).length;
    
    // Get defaulters for the year
    const defaulters = await prisma.customer.count({
      where: {
        status: 'DEFAULTED',
        lastDate: {
          gte: startOfYear,
          lte: endOfYear
        }
      }
    });

    const totalMembers = paidMembers + pendingMembers;
    const collectionRate = totalMembers > 0 ? ((paidMembers / totalMembers) * 100).toFixed(1) : 0;

    res.json({
      success: true,
      data: {
        totalCollection,
        paidMembers,
        pendingMembers,
        defaulters,
        collectionRate: parseFloat(collectionRate)
      }
    });
  } catch (error) {
    console.error('Yearly report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate yearly report',
      error: error.message
    });
  }
});

// Get top customers report
router.get('/top-customers', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const topCustomers = await prisma.customer.findMany({
      select: {
        id: true,
        name: true,
        status: true,
        amountPerDay: true,
        duration: true,
        _count: {
          select: {
            collections: true
          }
        }
      },
      orderBy: {
        collections: {
          _count: 'desc'
        }
      },
      take: parseInt(limit)
    });

    // Calculate total paid and balance for each customer
    const customersWithStats = await Promise.all(
      topCustomers.map(async (customer) => {
        const totalPaid = await prisma.collection.aggregate({
          where: { customerId: customer.id },
          _sum: { amountPaid: true }
        });

        const totalAmount = (customer.amountPerDay || 0) * (customer.duration || 0);
        const balance = totalAmount - (totalPaid._sum.amountPaid || 0);

        return {
          id: customer.id,
          name: customer.name,
          totalPaid: totalPaid._sum.amountPaid || 0,
          balance: Math.max(0, balance),
          status: customer.status
        };
      })
    );

    res.json({
      success: true,
      data: customersWithStats
    });
  } catch (error) {
    console.error('Top customers report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate top customers report',
      error: error.message
    });
  }
});

// Get scheme performance report
router.get('/scheme-performance', authenticateToken, async (req, res) => {
  try {
    const schemes = await prisma.chitScheme.findMany({
      select: {
        id: true,
        name: true,
        chitValue: true,
        duration: true,
        numberOfMembers: true,
        status: true,
        _count: {
          select: {
            customerSchemes: true
          }
        }
      }
    });

    const schemePerformance = await Promise.all(
      schemes.map(async (scheme) => {
        // Get total collections for this scheme through CustomerScheme
        const totalCollections = await prisma.collection.aggregate({
          where: {
            customer: {
              schemes: {
                some: {
                  schemeId: scheme.id
                }
              }
            }
          },
          _sum: { amountPaid: true }
        });

        const totalExpected = scheme.chitValue * scheme.numberOfMembers;
        const totalCollected = totalCollections._sum.amountPaid || 0;
        const collectionRate = totalExpected > 0 ? ((totalCollected / totalExpected) * 100).toFixed(1) : 0;

        return {
          id: scheme.id,
          scheme: scheme.name,
          members: scheme.numberOfMembers,
          enrolled: scheme._count.customerSchemes,
          collection: parseFloat(collectionRate),
          status: scheme.status
        };
      })
    );

    res.json({
      success: true,
      data: schemePerformance
    });
  } catch (error) {
    console.error('Scheme performance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate scheme performance report',
      error: error.message
    });
  }
});

module.exports = router;
