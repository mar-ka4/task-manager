/**
 * Скрипт для проверки наличия полей images и files в таблице tasks
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function main() {
  try {
    console.log('Проверка полей в таблице tasks...\n');
    
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name IN ('images', 'files')
      ORDER BY column_name
    `);
    
    console.log('Найденные поля:');
    if (result.rows.length === 0) {
      console.log('  ✗ Поля images и files не найдены!');
    } else {
      result.rows.forEach(row => {
        console.log(`  ✓ ${row.column_name} (${row.data_type})`);
      });
    }
    
    // Проверяем все поля таблицы tasks
    const allColumns = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tasks'
      ORDER BY column_name
    `);
    
    console.log('\nВсе поля таблицы tasks:');
    allColumns.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });
    
  } catch (error) {
    console.error('Ошибка:', error.message);
  } finally {
    await pool.end();
  }
}

main();
