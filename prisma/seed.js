const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear all existing data first
  console.log('🧹 Clearing existing data...');
  await prisma.passbookEntry.deleteMany({});
  await prisma.collection.deleteMany({});
  await prisma.auction.deleteMany({});
  await prisma.customer.deleteMany({});
  await prisma.chitScheme.deleteMany({});
  await prisma.user.deleteMany({});
  console.log('✅ All existing data cleared');

  // Create only admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.create({
    data: {
      email: 'admin@bhavanichits.com',
      password: adminPassword,
      name: 'Admin User',
      role: 'ADMIN',
      isActive: true
    }
  });

  console.log('✅ Admin user created');

  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📋 Admin login credentials:');
  console.log('Email: admin@bhavanichits.com');
  console.log('Password: admin123');
  console.log('\n💡 You can now create chit schemes, customers, and other data through the admin panel.');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
