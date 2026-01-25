const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : {
    rejectUnauthorized: false,
  },
});

async function applyMigration() {
  try {
    const sql = fs.readFileSync(
      path.join(__dirname, '../migrations/add_marker_type_to_tasks.sql'),
      'utf8'
    );
    
    console.log('Applying migration: add_marker_type_to_tasks.sql');
    await pool.query(sql);
    console.log('✓ Migration applied successfully!');
    
    // Проверяем, что поле добавлено
    const checkResult = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'tasks' 
      AND column_name = 'marker_type'
    `);
    
    if (checkResult.rows.length > 0) {
      console.log('✓ Field marker_type exists in tasks table');
      console.log('  Type:', checkResult.rows[0].data_type);
      console.log('  Default:', checkResult.rows[0].column_default);
    } else {
      console.log('⚠ Warning: Field marker_type not found after migration');
    }
  } catch (error) {
    console.error('✗ Migration error:', error.message);
    if (error.code === '42701') {
      console.log('  (Field already exists, this is OK)');
    } else {
      throw error;
    }
  } finally {
    await pool.end();
  }
}

applyMigration()
  .then(() => {
    console.log('Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
