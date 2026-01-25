/**
 * Скрипт для проверки наличия полей images и files в таблице tasks
 * Запуск: node backend/scripts/check-migrations.js
 */

const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');

dotenv.config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false,
  },
});

async function checkColumn(columnName) {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'tasks' 
      AND column_name = $1
    `, [columnName]);
    
    return result.rows.length > 0;
  } catch (error) {
    console.error(`Ошибка при проверке поля ${columnName}:`, error.message);
    return false;
  }
}

async function applyMigration(filename) {
  try {
    const sqlPath = path.join(__dirname, '../migrations', filename);
    if (!fs.existsSync(sqlPath)) {
      console.error(`Файл миграции не найден: ${sqlPath}`);
      return false;
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log(`✓ Миграция применена: ${filename}`);
    return true;
  } catch (error) {
    console.error(`Ошибка при применении миграции ${filename}:`, error.message);
    if (error.message.includes('already exists') || error.message.includes('duplicate')) {
      console.log(`  (Поле уже существует, это нормально)`);
      return true;
    }
    return false;
  }
}

async function main() {
  console.log('Проверка миграций для таблицы tasks...\n');
  
  const hasImages = await checkColumn('images');
  const hasFiles = await checkColumn('files');
  
  console.log(`Поле images: ${hasImages ? '✓ существует' : '✗ отсутствует'}`);
  console.log(`Поле files: ${hasFiles ? '✓ существует' : '✗ отсутствует'}\n`);
  
  if (!hasImages) {
    console.log('Применение миграции для поля images...');
    await applyMigration('add_images_to_tasks.sql');
  }
  
  if (!hasFiles) {
    console.log('Применение миграции для поля files...');
    await applyMigration('add_files_to_tasks.sql');
  }
  
  // Проверяем еще раз
  console.log('\nПовторная проверка...');
  const hasImagesAfter = await checkColumn('images');
  const hasFilesAfter = await checkColumn('files');
  
  console.log(`Поле images: ${hasImagesAfter ? '✓ существует' : '✗ отсутствует'}`);
  console.log(`Поле files: ${hasFilesAfter ? '✓ существует' : '✗ отсутствует'}`);
  
  if (hasImagesAfter && hasFilesAfter) {
    console.log('\n✓ Все миграции применены успешно!');
  } else {
    console.log('\n✗ Некоторые миграции не были применены. Проверьте ошибки выше.');
  }
  
  await pool.end();
}

main().catch(console.error);
