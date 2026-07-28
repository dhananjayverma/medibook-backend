const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
require('dotenv').config();

const SPECIALIZATIONS = [
  'Cardiology', 'Dermatology', 'Endocrinology', 'Gastroenterology',
  'General Practice', 'Gynecology', 'Hematology', 'Infectious Disease',
  'Nephrology', 'Neurology', 'Obstetrics', 'Oncology', 'Ophthalmology',
  'Orthopedics', 'Otolaryngology', 'Pediatrics', 'Psychiatry', 'Pulmonology',
  'Radiology', 'Rheumatology', 'Surgery', 'Urology', 'Anesthesiology',
  'Emergency Medicine', 'Family Medicine', 'Internal Medicine', 'Pathology',
  'Physical Medicine', 'Sports Medicine', 'Geriatrics'
];

const FIRST_NAMES = [
  'Arjun', 'Aarav', 'Vihaan', 'Aditya', 'Rohan', 'Amit', 'Rahul', 'Sanjay',
  'Dev', 'Karan', 'Kabir', 'Rudra', 'Nikhil', 'Piyush', 'Ravi', 'Vikram',
  'Sameer', 'Vijay', 'Alok', 'Deepak', 'Rajesh', 'Anil', 'Sunil', 'Manoj',
  'Priya', 'Ananya', 'Riya', 'Neha', 'Pooja', 'Shreya', 'Sneha', 'Aaradhya',
  'Kavya', 'Aditi', 'Divya', 'Isha', 'Meera', 'Ritu', 'Kiran', 'Swati',
  'Tanvi', 'Anjali', 'Preeti', 'Jyoti', 'Harsh', 'Mohit', 'Yash', 'Gaurav',
  'Varun', 'Raman', 'Abhishek', 'Aman', 'Saurabh', 'Manish', 'Pranav'
];

const LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Mehta', 'Joshi', 'Reddy', 'Patel', 'Singh',
  'Kumar', 'Yadav', 'Mishra', 'Trivedi', 'Pandey', 'Iyer', 'Nair', 'Pillai',
  'Sen', 'Roy', 'Das', 'Banerjee', 'Chatterjee', 'Mukherjee', 'Bose', 'Dutta',
  'Rao', 'Choudhury', 'Jha', 'Verma', 'Sinha', 'Kapoor', 'Malhotra', 'Khanna',
  'Saxena', 'Deshmukh', 'Kulkarni', 'Bhat', 'Hegde', 'Shenoy', 'Prabhu'
];

const HOSPITALS = [
  'Apollo Hospitals', 'KIMS Hospital', 'Manipal Hospitals', 'Max Super Speciality',
  'Fortis Healthcare', 'Medanta The Medicity', 'Wockhardt Hospitals', 'Kokilaben Hospital',
  'Lilavati Hospital', 'Sir Ganga Ram Hospital', 'Narayana Health', 'Columbia Asia',
  'Aster DM Healthcare', 'CARE Hospitals', 'Asian Heart Institute', 'Global Hospitals'
];

const QUALIFICATIONS = [
  'MD, PhD', 'MBBS, MD', 'MD, FACP', 'DO, MBA', 'MBBS, MS', 'MD, FRCS',
  'MBBS, DNB', 'MD, MCh', 'MBBS, DM', 'MD, FACS'
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

function getRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateEmail(firstName, lastName, index, role) {
  const domains = ['gmail.com', 'yahoo.com', 'hotmail.com', 'outlook.com', 'medical.com'];
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@${getRandom(domains)}`;
}

function generatePhone() {
  return `+1${getRandomInt(200, 999)}${getRandomInt(1000000, 9999999)}`;
}

function generateDateOfBirth() {
  const year = getRandomInt(1960, 2000);
  const month = String(getRandomInt(1, 12)).padStart(2, '0');
  const day = String(getRandomInt(1, 28)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function seed() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'appointment_booking',
    multipleStatements: true,
  });

  try {
    console.log('🌱 Starting seeder...');
    console.log('🔑 Hashing password (this may take a moment)...');

    // Hash password once and reuse for speed
    const hashedPassword = await bcrypt.hash('password123', 10);

    // Clear existing data
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    await connection.query('TRUNCATE TABLE appointments');
    await connection.query('TRUNCATE TABLE availability_slots');
    await connection.query('TRUNCATE TABLE patients');
    await connection.query('TRUNCATE TABLE doctors');
    await connection.query('TRUNCATE TABLE users');
    await connection.query('SET FOREIGN_KEY_CHECKS = 1');

    console.log('📥 Inserting 2,000 doctors...');

    const BATCH_SIZE = 100;

    // Insert doctors
    for (let batch = 0; batch < 20; batch++) {
      const userValues = [];
      const doctorValues = [];

      for (let i = 0; i < BATCH_SIZE; i++) {
        const idx = batch * BATCH_SIZE + i + 1;
        const firstName = getRandom(FIRST_NAMES);
        const lastName = getRandom(LAST_NAMES);
        const email = generateEmail(firstName, lastName, idx, 'doctor');
        const phone = generatePhone();

        userValues.push([
          email, hashedPassword, 'doctor',
          `Dr. ${firstName} ${lastName}`, phone
        ]);

        doctorValues.push({
          specialization: getRandom(SPECIALIZATIONS),
          qualification: getRandom(QUALIFICATIONS),
          experience_years: getRandomInt(1, 35),
          consultation_fee: (getRandomInt(50, 500) * 1.0).toFixed(2),
          hospital_name: getRandom(HOSPITALS),
          hospital_address: `${getRandomInt(1, 999)} Medical Ave, City, State ${getRandomInt(10000, 99999)}`,
          about: `Experienced ${getRandom(SPECIALIZATIONS)} specialist with over ${getRandomInt(1, 35)} years of practice. Dedicated to providing excellent patient care.`,
          rating: (getRandomInt(35, 50) / 10).toFixed(2),
          total_reviews: getRandomInt(0, 500),
          is_available: Math.random() > 0.1 ? 1 : 0,
        });
      }

      // Insert users batch
      const [userResult] = await connection.query(
        `INSERT INTO users (email, password, role, full_name, phone) VALUES ?`,
        [userValues]
      );

      const firstUserId = userResult.insertId;

      // Insert doctors batch
      const doctorValueArray = doctorValues.map((d, i) => [
        firstUserId + i,
        d.specialization, d.qualification, d.experience_years,
        d.consultation_fee, d.hospital_name, d.hospital_address,
        d.about, d.rating, d.total_reviews, d.is_available
      ]);

      await connection.query(
        `INSERT INTO doctors (user_id, specialization, qualification, experience_years, consultation_fee, hospital_name, hospital_address, about, rating, total_reviews, is_available) VALUES ?`,
        [doctorValueArray]
      );

      process.stdout.write(`  Inserted ${Math.min((batch + 1) * BATCH_SIZE, 2000)} / 2000 doctors\r`);
    }
    console.log('\n✅ 2,000 doctors inserted!');

    console.log('📥 Inserting 2,000 patients...');

    // Insert patients
    for (let batch = 0; batch < 20; batch++) {
      const userValues = [];
      const patientValues = [];

      for (let i = 0; i < BATCH_SIZE; i++) {
        const idx = batch * BATCH_SIZE + i + 1;
        const firstName = getRandom(FIRST_NAMES);
        const lastName = getRandom(LAST_NAMES);
        const email = generateEmail(firstName, lastName, idx + 1000, 'patient');
        const phone = generatePhone();

        userValues.push([
          email, hashedPassword, 'patient',
          `${firstName} ${lastName}`, phone
        ]);

        patientValues.push([
          generateDateOfBirth(),
          getRandom(['male', 'female', 'other']),
          getRandom(BLOOD_GROUPS),
          `${getRandomInt(1, 999)} Patient St, City, State ${getRandomInt(10000, 99999)}`,
          generatePhone(),
          'No significant medical history'
        ]);
      }

      const [userResult] = await connection.query(
        `INSERT INTO users (email, password, role, full_name, phone) VALUES ?`,
        [userValues]
      );

      const firstUserId = userResult.insertId;

      const patientValueArray = patientValues.map((p, i) => [
        firstUserId + i, ...p
      ]);

      await connection.query(
        `INSERT INTO patients (user_id, date_of_birth, gender, blood_group, address, emergency_contact, medical_history) VALUES ?`,
        [patientValueArray]
      );

      process.stdout.write(`  Inserted ${Math.min((batch + 1) * BATCH_SIZE, 2000)} / 2000 patients\r`);
    }
    console.log('\n✅ 2,000 patients inserted!');

    console.log('📅 Seeding availability slots for doctors...');

    // Get first 50 doctors and create slots for next 30 days
    const [doctors] = await connection.query(
      'SELECT id FROM doctors ORDER BY id LIMIT 50'
    );

    const slotValues = [];
    const today = new Date();

    for (const doctor of doctors) {
      for (let day = 0; day < 30; day++) {
        const slotDate = new Date(today);
        slotDate.setDate(today.getDate() + day);
        const dateStr = slotDate.toISOString().split('T')[0];

        // Skip random days
        if (Math.random() < 0.2) continue;

        // Morning slots: 9:00 - 13:00 (30-min intervals)
        const morningSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30'];
        // Afternoon slots: 14:00 - 18:00
        const afternoonSlots = ['14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30'];

        const allSlots = [...morningSlots, ...afternoonSlots];

        for (const startTime of allSlots) {
          if (Math.random() < 0.3) continue; // Skip some slots randomly

          const [h, m] = startTime.split(':').map(Number);
          const endHour = m === 30 ? h + 1 : h;
          const endMin = m === 30 ? '00' : '30';
          const endTime = `${String(endHour).padStart(2, '0')}:${endMin}`;

          slotValues.push([doctor.id, dateStr, startTime, endTime, 0, 1]);
        }
      }
    }

    // Insert slots in batches
    for (let i = 0; i < slotValues.length; i += 500) {
      const batch = slotValues.slice(i, i + 500);
      await connection.query(
        `INSERT IGNORE INTO availability_slots (doctor_id, slot_date, start_time, end_time, is_booked, is_active) VALUES ?`,
        [batch]
      );
    }

    console.log(`✅ ${slotValues.length} availability slots created!`);

    console.log('\n🎉 Seeding complete!');
    console.log('\n📋 Login credentials:');
    console.log('  Doctor email:   arjun.sharma1@gmail.com | password: password123');
    console.log('  Patient email:  priya.verma1001@gmail.com | password: password123');
    console.log('\nNote: Check the database for exact emails. All passwords are: password123');

    // Print first doctor and patient emails
    const [firstDoctor] = await connection.query(
      `SELECT u.email FROM users u JOIN doctors d ON d.user_id = u.id LIMIT 1`
    );
    const [firstPatient] = await connection.query(
      `SELECT u.email FROM users u JOIN patients p ON p.user_id = u.id LIMIT 1`
    );

    if (firstDoctor.length > 0) {
      console.log(`\n✅ First doctor email: ${firstDoctor[0].email}`);
    }
    if (firstPatient.length > 0) {
      console.log(`✅ First patient email: ${firstPatient[0].email}`);
    }

  } catch (error) {
    console.error('❌ Seeding failed:', error.message);
    console.error(error);
    throw error;
  } finally {
    await connection.end();
  }
}

seed()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
