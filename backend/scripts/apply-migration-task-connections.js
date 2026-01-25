const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function applyMigration() {
  try {
    console.log('Применение миграции: add_edges_to_task_connections.sql');
    console.log('Подключение к базе данных...');
    
    const migrationPath = path.join(__dirname, '../migrations/add_edges_to_task_connections.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('Выполнение SQL...');
    await pool.query(sql);
    
    console.log('✓ Миграция успешно применена!');
    console.log('\nПроверка результата...');
    
    // Проверяем, что поля были добавлены
    const checkResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'task_connections' 
      AND column_name IN ('from_edge', 'to_edge')
      ORDER BY column_name
    `);
    
    if (checkResult.rows.length === 2) {
      console.log('✓ Поля успешно добавлены:');
      checkResult.rows.forEach(row => {
        console.log(`  - ${row.column_name} (${row.data_type})`);
      });
    } else {
      console.log('⚠ Предупреждение: не все поля найдены');
      console.log('Найденные поля:', checkResult.rows);
    }
    
    console.log('\nМиграция завершена успешно!');
  } catch (error) {
    console.error('❌ Ошибка при применении миграции:', error.message);
    if (error.code) {
      console.error('Код ошибки:', error.code);
    }
    if (error.detail) {
      console.error('Детали:', error.detail);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
