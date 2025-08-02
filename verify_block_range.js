/**
 * =================================================================
 * Archivo: verify_block_range.js
 * Descripción: Script para verificar si el rango de bloques (primero y último)
 * y el conteo de transacciones son consistentes entre los archivos de datos
 * de la mempool y de transacciones minadas.
 *
 * Para ejecutar:
 * 1. Asegúrate de tener 'csv-parse' instalado (`npm install csv-parse`).
 * 2. Coloca este script en la misma carpeta que tus archivos CSV.
 * 3. Ejecuta desde la terminal: node verify_block_range.js
 * =================================================================
 */

import fs from 'fs';
import { parse } from 'csv-parse';

// --- CONFIGURACIÓN ---
// Nombres de los archivos a comparar
const MEMPOOL_CSV_PATH = './mempool_data_sepolia.csv';
const MINED_CSV_PATH = './mined_transactions_data.csv';

/**
 * Función para leer un archivo CSV y extraer estadísticas (rango de bloques y conteo de transacciones).
 * Utiliza streams para manejar archivos grandes sin consumir mucha memoria.
 * @param {string} filePath - La ruta al archivo CSV.
 * @param {string} columnName - El nombre de la columna que contiene el número de bloque.
 * @returns {Promise<{min: number, max: number, count: number}>} Un objeto con el bloque mínimo, máximo y el conteo de transacciones.
 */
function getFileStats(filePath, columnName) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(filePath)) {
            return reject(new Error(`El archivo no fue encontrado: ${filePath}`));
        }

        let minBlock = Infinity;
        let maxBlock = -Infinity;
        let txCount = 0; // Contador para las transacciones

        const parser = fs.createReadStream(filePath)
            .pipe(parse({
                columns: true,
                trim: true,
                skip_empty_lines: true
            }));

        parser.on('data', (row) => {
            txCount++; // Incrementar el contador por cada fila (transacción)
            const blockNum = parseInt(row[columnName], 10);
            if (!isNaN(blockNum)) {
                if (blockNum < minBlock) {
                    minBlock = blockNum;
                }
                if (blockNum > maxBlock) {
                    maxBlock = blockNum;
                }
            }
        });

        parser.on('end', () => {
            if (minBlock === Infinity || maxBlock === -Infinity) {
                return reject(new Error(`No se encontraron números de bloque válidos en la columna '${columnName}' del archivo ${filePath}`));
            }
            resolve({ min: minBlock, max: maxBlock, count: txCount });
        });

        parser.on('error', (err) => {
            reject(err);
        });
    });
}

/**
 * Función principal que ejecuta la verificación.
 */
async function main() {
    console.log('--- Iniciando Verificación de Rango de Bloques y Conteo de Transacciones ---');

    try {
        // Obtener las estadísticas de ambos archivos en paralelo
        const [mempoolStats, minedStats] = await Promise.all([
            getFileStats(MEMPOOL_CSV_PATH, 'NetworkBlock'),
            getFileStats(MINED_CSV_PATH, 'BlockNumber')
        ]);

        console.log(`\nArchivo Mempool ('${MEMPOOL_CSV_PATH}'):`);
        console.log(`  -> Primer bloque (min NetworkBlock): ${mempoolStats.min}`);
        console.log(`  -> Último bloque (max NetworkBlock): ${mempoolStats.max}`);
        console.log(`  -> Transacciones totales: ${mempoolStats.count.toLocaleString('es-CL')}`);


        console.log(`\nArchivo Mined ('${MINED_CSV_PATH}'):`);
        console.log(`  -> Primer bloque (min BlockNumber):  ${minedStats.min}`);
        console.log(`  -> Último bloque (max BlockNumber):  ${minedStats.max}`);
        console.log(`  -> Transacciones totales: ${minedStats.count.toLocaleString('es-CL')}`);

        // Comparar los resultados
        const firstBlockMatch = mempoolStats.min === minedStats.min;
        const lastBlockMatch = mempoolStats.max === minedStats.max;

        console.log('\n--- Resultado de la Verificación ---');
        if (firstBlockMatch && lastBlockMatch) {
            console.log('✅ ¡ÉXITO! Los rangos de bloques coinciden perfectamente.');
        } else {
            console.log('❌ ¡FALLO! Los rangos de bloques NO coinciden.');
            if (!firstBlockMatch) {
                console.log(`  - El primer bloque no coincide: Mempool (${mempoolStats.min}) vs Mined (${minedStats.min})`);
            }
            if (!lastBlockMatch) {
                console.log(`  - El último bloque no coincide: Mempool (${mempoolStats.max}) vs Mined (${minedStats.max})`);
            }
        }
        console.log('------------------------------------');

    } catch (error) {
        console.error('\nOcurrió un error durante la verificación:', error.message);
    }
}

// Ejecutar el script
main();
