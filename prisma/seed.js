const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@bhavanichits.com' },
    update: {},
    create: {
      email: 'admin@bhavanichits.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true
    }
  });

  // Create agent user
  const agentPassword = await bcrypt.hash('agent123', 12);
  const agent = await prisma.user.upsert({
    where: { email: 'agent@bhavanichits.com' },
    update: {},
    create: {
      email: 'agent@bhavanichits.com',
      password: agentPassword,
      name: 'Agent User',
      role: 'AGENT',
      isActive: true
    }
  });

  // Create collector user
  const collectorPassword = await bcrypt.hash('collector123', 12);
  const collector = await prisma.user.upsert({
    where: { email: 'collector@bhavanichits.com' },
    update: {},
    create: {
      email: 'collector@bhavanichits.com',
      password: collectorPassword,
      name: 'Collector User',
      role: 'COLLECTOR',
      isActive: true
    }
  });

  console.log('✅ Users created');

  // Create chit schemes
  const scheme1 = await prisma.chitScheme.upsert({
    where: { id: 'scheme-1' },
    update: {},
    create: {
      id: 'scheme-1',
      name: '₹5,00,000 - 30 months',
      chitValue: 500000,
      duration: 30,
      durationType: 'MONTHS',
      dailyPayment: 500,
      monthlyPayment: 15000,
      numberOfMembers: 30,
      auctionRules: 'Before lifting: ₹500 daily, After lifting: ₹500 daily',
      status: 'ACTIVE',
      membersEnrolled: 0,
      startDate: new Date('2024-01-01'),
      endDate: new Date('2026-07-01'),
      lastDate: new Date('2026-06-30'),
      description: 'Premium 30-month chit scheme with flexible payment options',
      commissionRate: 0.05,
      penaltyRate: 0.02,
      minBidAmount: 10000,
      maxBidAmount: 450000,
      isActive: true,
      createdBy: admin.id
    }
  });

  const scheme2 = await prisma.chitScheme.upsert({
    where: { id: 'scheme-2' },
    update: {},
    create: {
      id: 'scheme-2',
      name: '₹5,00,000 - 200 days',
      chitValue: 500000,
      duration: 200,
      durationType: 'DAYS',
      dailyPayment: 2500,
      monthlyPayment: 75000,
      numberOfMembers: 20,
      auctionRules: 'Before lifting: ₹2500 daily, After lifting: ₹3000 daily',
      status: 'ACTIVE',
      membersEnrolled: 0,
      startDate: new Date('2024-02-01'),
      endDate: new Date('2024-08-19'),
      lastDate: new Date('2024-08-18'),
      description: 'Short-term high-value chit scheme for quick returns',
      commissionRate: 0.03,
      penaltyRate: 0.01,
      minBidAmount: 20000,
      maxBidAmount: 480000,
      isActive: true,
      createdBy: admin.id
    }
  });

  const scheme3 = await prisma.chitScheme.upsert({
    where: { id: 'scheme-3' },
    update: {},
    create: {
      id: 'scheme-3',
      name: '₹3,00,000 - 18 months',
      chitValue: 300000,
      duration: 18,
      durationType: 'MONTHS',
      dailyPayment: 300,
      monthlyPayment: 9000,
      numberOfMembers: 25,
      auctionRules: 'Before lifting: ₹300 daily, After lifting: ₹300 daily',
      status: 'COMPLETED',
      membersEnrolled: 0,
      startDate: new Date('2023-01-01'),
      endDate: new Date('2024-07-01'),
      lastDate: new Date('2024-06-30'),
      description: 'Completed 18-month chit scheme with moderate returns',
      commissionRate: 0.04,
      penaltyRate: 0.015,
      minBidAmount: 5000,
      maxBidAmount: 280000,
      isActive: false,
      createdBy: admin.id
    }
  });

  console.log('✅ Chit schemes created');

  // Create sample customers
  const customers = [
    {
      id: 'customer-1',
      name: 'Rajesh Kumar',
      mobile: '9876543210',
      address: '123 Main Street, Bangalore, Karnataka 560001',
      schemeId: scheme1.id,
      startDate: new Date('2024-01-15'),
      lastDate: new Date('2024-12-15'),
      amountPerDay: 500,
      duration: 30,
      durationType: 'MONTHS',
      status: 'ACTIVE',
      balance: 45000,
      group: 'Group A',
      photo: null,
      documents: ['Aadhar Card', 'PAN Card']
    },
    {
      id: 'customer-2',
      name: 'Priya Sharma',
      mobile: '9876543211',
      address: '456 Park Avenue, Mumbai, Maharashtra 400001',
      schemeId: scheme2.id,
      startDate: new Date('2024-02-01'),
      lastDate: new Date('2024-08-18'),
      amountPerDay: 2500,
      duration: 200,
      durationType: 'DAYS',
      status: 'ACTIVE',
      balance: 125000,
      group: 'Group B',
      photo: null,
      documents: ['Aadhar Card', 'Bank Passbook']
    },
    {
      id: 'customer-3',
      name: 'Amit Singh',
      mobile: '9876543212',
      address: '789 Garden Road, Delhi, Delhi 110001',
      schemeId: scheme1.id,
      startDate: new Date('2023-12-01'),
      lastDate: new Date('2024-06-01'),
      amountPerDay: 500,
      duration: 30,
      durationType: 'MONTHS',
      status: 'COMPLETED',
      balance: 0,
      group: 'Group A',
      photo: null,
      documents: ['Aadhar Card', 'PAN Card', 'Voter ID']
    },
    {
      id: 'customer-4',
      name: 'Sunita Patel',
      mobile: '9876543213',
      address: '321 Lake View, Pune, Maharashtra 411001',
      schemeId: scheme2.id,
      startDate: new Date('2024-03-15'),
      lastDate: new Date('2024-08-18'),
      amountPerDay: 3000,
      duration: 200,
      durationType: 'DAYS',
      status: 'DEFAULTED',
      balance: 180000,
      group: 'Group C',
      photo: null,
      documents: ['Aadhar Card']
    },
    {
      id: 'customer-5',
      name: 'Vikram Reddy',
      mobile: '9876543214',
      address: '555 Tech Park, Hyderabad, Telangana 500001',
      schemeId: scheme3.id,
      startDate: new Date('2024-01-01'),
      lastDate: new Date('2024-07-01'),
      amountPerDay: 300,
      duration: 18,
      durationType: 'MONTHS',
      status: 'ACTIVE',
      balance: 27000,
      group: 'Group B',
      photo: null,
      documents: ['Aadhar Card', 'PAN Card']
    }
  ];

  for (const customerData of customers) {
    await prisma.customer.upsert({
      where: { id: customerData.id },
      update: {},
      create: customerData
    });

    // Update scheme members enrolled count
    await prisma.chitScheme.update({
      where: { id: customerData.schemeId },
      data: {
        membersEnrolled: {
          increment: 1
        }
      }
    });
  }

  console.log('✅ Customers created');

  // Create sample collections
  const collections = [
    {
      customerId: 'customer-1',
      amountPaid: 500,
      collectorId: collector.id,
      date: new Date('2024-12-14'),
      balanceRemaining: 44500,
      paymentMethod: 'CASH',
      remarks: 'On time payment'
    },
    {
      customerId: 'customer-2',
      amountPaid: 2500,
      collectorId: collector.id,
      date: new Date('2024-12-14'),
      balanceRemaining: 122500,
      paymentMethod: 'BANK_TRANSFER',
      remarks: 'Early payment'
    },
    {
      customerId: 'customer-3',
      amountPaid: 500,
      collectorId: collector.id,
      date: new Date('2024-12-14'),
      balanceRemaining: 0,
      paymentMethod: 'CASH',
      remarks: 'Regular payment'
    },
    {
      customerId: 'customer-4',
      amountPaid: 0,
      collectorId: collector.id,
      date: new Date('2024-12-14'),
      balanceRemaining: 180000,
      paymentMethod: 'NOT_PAID',
      remarks: 'Defaulted - 3 days overdue'
    }
  ];

  for (const collectionData of collections) {
    await prisma.collection.create({
      data: collectionData
    });
  }

  console.log('✅ Collections created');

  // Create sample auctions
  const auctions = [
    {
      chitSchemeId: scheme1.id,
      auctionDate: new Date('2024-12-10'),
      winningMemberId: 'customer-1',
      amountReceived: 500000,
      discountAmount: 0,
      newDailyPayment: 500,
      previousDailyPayment: 500,
      status: 'COMPLETED',
      remarks: 'Full amount received',
      createdById: admin.id
    },
    {
      chitSchemeId: scheme2.id,
      auctionDate: new Date('2024-12-08'),
      winningMemberId: 'customer-2',
      amountReceived: 450000,
      discountAmount: 50000,
      newDailyPayment: 3000,
      previousDailyPayment: 2500,
      status: 'COMPLETED',
      remarks: '₹50,000 discount applied',
      createdById: admin.id
    },
    {
      chitSchemeId: scheme1.id,
      auctionDate: new Date('2024-12-15'),
      winningMemberId: null,
      amountReceived: 0,
      discountAmount: 0,
      newDailyPayment: 500,
      previousDailyPayment: 500,
      status: 'SCHEDULED',
      remarks: 'Upcoming auction',
      createdById: admin.id
    }
  ];

  for (const auctionData of auctions) {
    await prisma.auction.create({
      data: auctionData
    });
  }

  console.log('✅ Auctions created');

  // Clear existing passbook entries (remove seeded data)
  await prisma.passbookEntry.deleteMany({});
  console.log('✅ Existing passbook entries cleared');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Login credentials:');
  console.log('Admin: admin@bhavanichits.com / admin123');
  console.log('Agent: agent@bhavanichits.com / agent123');
  console.log('Collector: collector@bhavanichits.com / collector123');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
