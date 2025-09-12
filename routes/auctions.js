const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { auctionValidations, commonValidations, handleValidationErrors } = require('../middleware/validation');
const { authenticateToken, requireAgentOrAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get all auctions with pagination and filtering
router.get('/', authenticateToken, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      status,
      chitSchemeId,
      search,
      sortBy = 'auctionDate',
      sortOrder = 'desc'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = parseInt(limit);

    // Build where clause
    const where = {};
    
    if (status) {
      where.status = status;
    }
    
    if (chitSchemeId) {
      where.chitSchemeId = chitSchemeId;
    }
    
    if (search) {
      where.OR = [
        { chitScheme: { name: { contains: search, mode: 'insensitive' } } },
        { winningMember: { name: { contains: search, mode: 'insensitive' } } },
        { remarks: { contains: search, mode: 'insensitive' } }
      ];
    }

    // Get total count
    const totalCount = await prisma.auction.count({ where });

    // Get auctions
    const auctions = await prisma.auction.findMany({
      where,
      skip,
      take,
      orderBy: { [sortBy]: sortOrder },
      include: {
        chitScheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true
          }
        },
        winningMember: {
          select: {
            id: true,
            name: true,
            mobile: true,
            group: true
          }
        },
        createdBy: {
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
        auctions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: totalCount,
          pages: Math.ceil(totalCount / parseInt(limit))
        }
      }
    });
  } catch (error) {
    console.error('Get auctions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch auctions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get single auction by ID
router.get('/:id', authenticateToken, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        chitScheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true,
            dailyPayment: true
          }
        },
        winningMember: {
          select: {
            id: true,
            name: true,
            mobile: true,
            address: true,
            group: true,
            status: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    if (!auction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    res.json({
      success: true,
      data: { auction }
    });
  } catch (error) {
    console.error('Get auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch auction',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Create new auction
router.post('/', authenticateToken, requireAgentOrAdmin, auctionValidations.create, handleValidationErrors, async (req, res) => {
  try {
    const {
      chitSchemeId,
      auctionDate,
      winningMemberId,
      amountReceived = 0,
      discountAmount = 0,
      newDailyPayment,
      previousDailyPayment,
      status = 'SCHEDULED',
      remarks
    } = req.body;

    // Verify chit scheme exists
    const chitScheme = await prisma.chitScheme.findUnique({
      where: { id: chitSchemeId }
    });

    if (!chitScheme) {
      return res.status(400).json({
        success: false,
        message: 'Chit scheme not found'
      });
    }

    // Verify winning member exists if provided
    if (winningMemberId) {
      const winningMember = await prisma.customer.findUnique({
        where: { id: winningMemberId }
      });

      if (!winningMember) {
        return res.status(400).json({
          success: false,
          message: 'Winning member not found'
        });
      }

      // Check if member belongs to the same scheme
      if (winningMember.schemeId !== chitSchemeId) {
        return res.status(400).json({
          success: false,
          message: 'Winning member does not belong to this chit scheme'
        });
      }
    }

    const auction = await prisma.auction.create({
      data: {
        chitSchemeId,
        auctionDate: new Date(auctionDate),
        winningMemberId,
        amountReceived,
        discountAmount,
        newDailyPayment,
        previousDailyPayment,
        status,
        remarks,
        createdById: req.user.id
      },
      include: {
        chitScheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true
          }
        },
        winningMember: {
          select: {
            id: true,
            name: true,
            mobile: true,
            group: true
          }
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Auction scheduled successfully',
      data: { auction }
    });
  } catch (error) {
    console.error('Create auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to schedule auction',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Update auction
router.put('/:id', authenticateToken, requireAgentOrAdmin, commonValidations.id, auctionValidations.update, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if auction exists
    const existingAuction = await prisma.auction.findUnique({
      where: { id }
    });

    if (!existingAuction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // If updating winning member, verify they exist and belong to the scheme
    if (updateData.winningMemberId) {
      const winningMember = await prisma.customer.findUnique({
        where: { id: updateData.winningMemberId }
      });

      if (!winningMember) {
        return res.status(400).json({
          success: false,
          message: 'Winning member not found'
        });
      }

      if (winningMember.schemeId !== existingAuction.chitSchemeId) {
        return res.status(400).json({
          success: false,
          message: 'Winning member does not belong to this chit scheme'
        });
      }
    }

    const updatedAuction = await prisma.auction.update({
      where: { id },
      data: updateData,
      include: {
        chitScheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true
          }
        },
        winningMember: {
          select: {
            id: true,
            name: true,
            mobile: true,
            group: true
          }
        },
        createdBy: {
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
      message: 'Auction updated successfully',
      data: { auction: updatedAuction }
    });
  } catch (error) {
    console.error('Update auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update auction',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Delete auction
router.delete('/:id', authenticateToken, requireAgentOrAdmin, commonValidations.id, handleValidationErrors, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if auction exists
    const existingAuction = await prisma.auction.findUnique({
      where: { id }
    });

    if (!existingAuction) {
      return res.status(404).json({
        success: false,
        message: 'Auction not found'
      });
    }

    // Check if auction is completed
    if (existingAuction.status === 'COMPLETED') {
      return res.status(400).json({
        success: false,
        message: 'Cannot delete completed auction'
      });
    }

    await prisma.auction.delete({
      where: { id }
    });

    res.json({
      success: true,
      message: 'Auction deleted successfully'
    });
  } catch (error) {
    console.error('Delete auction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete auction',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get auction statistics
router.get('/stats/overview', authenticateToken, async (req, res) => {
  try {
    const { chitSchemeId } = req.query;

    const where = {};
    if (chitSchemeId) where.chitSchemeId = chitSchemeId;

    const [
      totalAuctions,
      scheduledAuctions,
      completedAuctions,
      cancelledAuctions,
      totalAmountReceived,
      totalDiscount
    ] = await Promise.all([
      prisma.auction.count({ where }),
      prisma.auction.count({ where: { ...where, status: 'SCHEDULED' } }),
      prisma.auction.count({ where: { ...where, status: 'COMPLETED' } }),
      prisma.auction.count({ where: { ...where, status: 'CANCELLED' } }),
      prisma.auction.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { amountReceived: true }
      }),
      prisma.auction.aggregate({
        where: { ...where, status: 'COMPLETED' },
        _sum: { discountAmount: true }
      })
    ]);

    const stats = {
      totalAuctions,
      scheduledAuctions,
      completedAuctions,
      cancelledAuctions,
      totalAmountReceived: totalAmountReceived._sum.amountReceived || 0,
      totalDiscount: totalDiscount._sum.discountAmount || 0
    };

    res.json({
      success: true,
      data: { stats }
    });
  } catch (error) {
    console.error('Get auction stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch auction statistics',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

// Get upcoming auctions
router.get('/upcoming/list', authenticateToken, async (req, res) => {
  try {
    const { limit = 10 } = req.query;

    const upcomingAuctions = await prisma.auction.findMany({
      where: {
        status: 'SCHEDULED',
        auctionDate: {
          gte: new Date()
        }
      },
      take: parseInt(limit),
      orderBy: { auctionDate: 'asc' },
      include: {
        chitScheme: {
          select: {
            id: true,
            name: true,
            chitValue: true,
            duration: true,
            durationType: true
          }
        },
        winningMember: {
          select: {
            id: true,
            name: true,
            mobile: true,
            group: true
          }
        }
      }
    });

    res.json({
      success: true,
      data: { auctions: upcomingAuctions }
    });
  } catch (error) {
    console.error('Get upcoming auctions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch upcoming auctions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;
