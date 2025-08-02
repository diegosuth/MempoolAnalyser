/**
 * =================================================================
 * Archivo: fcfs_persistent.js
 * Descripción: Versión mejorada del algoritmo FCFS que NO descarta
 * transacciones. Las transacciones no incluidas se mantienen en el pool
 * para ser consideradas en bloques futuros.
 *
 * EJECUCIÓN: node simplesepoliav3.js
 * =================================================================
 */

// --- Dependencias ---
import fs from 'fs';
import { parse } from 'csv-parse';
import { createObjectCsvWriter } from 'csv-writer';

// =================================================================
// --- CONFIGURACIÓN ---
// =================================================================

const INPUT_CSV_PATH = './mempool_data_sepolia.csv';
// CORRECCIÓN: Nombre de archivo de salida estandarizado
const OUTPUT_CSV_PATH = './fcfs_results.csv';

const BLOCK_INTERVAL_SECONDS = 12;
const GAS_TARGET = 30000000n;
const GAS_HARD_CAP = 60000000n;
const MAX_EXTRA_BLOCKS = 100; // Aumentado para permitir más bloques extra

// =================================================================
// --- LÓGICA DEL ALGORITMO FCFS (CON PERSISTENCIA) ---
// =================================================================

function buildBlocksFCFS(transactions) {
    console.log("-> Ejecutando Algoritmo FCFS (Versión con Persistencia)...");

    const cleanTxs = transactions.map(tx => {
        try {
            const gasLimit = BigInt(tx.GasLimit);
            if (isNaN(Date.parse(tx.TimeStamp)) || gasLimit === 0n || gasLimit > GAS_HARD_CAP) {
                return null;
            }
            return {
                ...tx,
                gasLimitNum: gasLimit,
                gananciaNum: BigInt(tx.GananciaxTransaccion),
                timeStampNum: Math.floor(Date.parse(tx.TimeStamp) / 1000),
            };
        } catch (e) { return null; }
    }).filter(tx => tx !== null);

    if (cleanTxs.length === 0) {
        console.log("Error Crítico: Ninguna transacción fue válida después de la limpieza.");
        return [];
    }
    
    let availableTxs = cleanTxs.sort((a, b) => a.timeStampNum - b.timeStampNum);
    const finalBuiltTxs = [];
    let blockNumber = 1;
    let blockStartTime = availableTxs[0].timeStampNum;

    while (availableTxs.length > 0 && blockStartTime <= availableTxs[availableTxs.length - 1].timeStampNum) {
        const candidates = availableTxs.filter(tx => tx.timeStampNum <= blockStartTime + BLOCK_INTERVAL_SECONDS);
        if (candidates.length > 0) {
            let currentBlockTxs = [];
            let currentBlockGas = 0n;
            let blockRewardWei = 0n;
            const includedInThisBlock = new Set();

            for (const tx of candidates) {
                if (currentBlockGas + tx.gasLimitNum <= GAS_HARD_CAP) {
                    currentBlockTxs.push(tx);
                    currentBlockGas += tx.gasLimitNum;
                    blockRewardWei += tx.gananciaNum;
                    includedInThisBlock.add(tx.TransactionHash);
                    if (currentBlockGas >= GAS_TARGET) break;
                }
            }

            if (currentBlockTxs.length > 0) {
                // --- CORRECCIÓN ---
                // Se añade el gas usado al mensaje de la consola.
                console.log(`-> Bloque #${blockNumber} construido con ${currentBlockTxs.length} transacciones. Gas usado: ${currentBlockGas.toString()}`);
                currentBlockTxs.forEach((tx, index) => {
                    tx.BlockNumber = blockNumber;
                    if (index === currentBlockTxs.length - 1) {
                        tx.BlockReward = blockRewardWei.toString();
                        tx.BlockGas = currentBlockGas.toString();
                    } else {
                        tx.BlockReward = '';
                        tx.BlockGas = '';
                    }
                });
                finalBuiltTxs.push(...currentBlockTxs);
                blockNumber++;
                availableTxs = availableTxs.filter(tx => !includedInThisBlock.has(tx.TransactionHash));
            }
        }
        blockStartTime += BLOCK_INTERVAL_SECONDS;
    }

    console.log(`\n--- Fin de la simulación de tiempo. ${availableTxs.length} transacciones restantes. ---`);
    console.log("--- Iniciando fase de construcción de bloques extra... ---");
    let extraBlocksBuilt = 0;
    while (availableTxs.length > 0 && extraBlocksBuilt < MAX_EXTRA_BLOCKS) {
        let currentBlockTxs = [];
        let currentBlockGas = 0n;
        let blockRewardWei = 0n;
        const includedInThisBlock = new Set();
        
        for (const tx of availableTxs) {
            if (currentBlockGas + tx.gasLimitNum <= GAS_HARD_CAP) {
                currentBlockTxs.push(tx);
                currentBlockGas += tx.gasLimitNum;
                blockRewardWei += tx.gananciaNum;
                includedInThisBlock.add(tx.TransactionHash);
                if (currentBlockGas >= GAS_TARGET) break;
            }
        }

        if (currentBlockTxs.length > 0) {
            extraBlocksBuilt++;
            // --- CORRECCIÓN ---
            // Se añade el gas usado al mensaje de la consola para los bloques extra.
            console.log(`-> Bloque Extra #${blockNumber} construido con ${currentBlockTxs.length} transacciones. Gas usado: ${currentBlockGas.toString()}`);
            currentBlockTxs.forEach((tx, index) => {
                tx.BlockNumber = blockNumber;
                if (index === currentBlockTxs.length - 1) {
                    tx.BlockReward = blockRewardWei.toString();
                    tx.BlockGas = currentBlockGas.toString();
                } else {
                    tx.BlockReward = '';
                    tx.BlockGas = '';
                }
            });
            finalBuiltTxs.push(...currentBlockTxs);
            blockNumber++;
            availableTxs = availableTxs.filter(tx => !includedInThisBlock.has(tx.TransactionHash));
        } else {
            console.log(`No se pueden construir más bloques. ${availableTxs.length} transacciones finales descartadas.`);
            break;
        }
    }
    return finalBuiltTxs;
}

async function readCsv(filePath) {
    return new Promise((resolve, reject) => {
        const records = [];
        fs.createReadStream(filePath)
            .pipe(parse({ columns: true, trim: true, skip_empty_lines: true }))
            .on('data', (row) => records.push(row))
            .on('end', () => resolve(records))
            .on('error', (error) => reject(error));
    });
}

async function writeCsv(filePath, data) {
    if (!data || data.length === 0) {
        console.warn(`No hay datos para escribir en ${filePath}.`);
        return;
    }
    const formattedData = data.map(tx => ({
        TransactionHash: tx.TransactionHash,
        TransactionType: tx.TransactionType,
        GasLimit: tx.GasLimit,
        MaxPriorityFee: tx.MaxPriorityFee,
        GananciaxTransaccion: tx.GananciaxTransaccion,
        TimeStamp: tx.TimeStamp,
        BlockNumber: tx.BlockNumber,
        BlockReward: tx.BlockReward,
        BlockGas: tx.BlockGas,
    }));
    const headers = Object.keys(formattedData[0]).map(key => ({ id: key, title: key }));
    const csvWriter = createObjectCsvWriter({ path: filePath, header: headers });
    await csvWriter.writeRecords(formattedData);
}

async function main() {
    console.log('Iniciando el procesador FCFS (versión con persistencia)...');
    try {
        const transactions = await readCsv(INPUT_CSV_PATH);
        if (transactions.length === 0) {
            console.log("El archivo de entrada está vacío.");
            return;
        }
        console.log(`-> Se leyeron ${transactions.length} transacciones de ${INPUT_CSV_PATH}.`);
        const fcfsResults = buildBlocksFCFS(transactions);
        if (fcfsResults.length > 0) {
            const totalBlocks = fcfsResults.reduce((max, tx) => Math.max(max, tx.BlockNumber || 0), 0);
            console.log(`\n-> Algoritmo finalizado. Se construyeron ${totalBlocks} bloques con ${fcfsResults.length} transacciones.`);
        } else {
            console.log("\n-> Algoritmo finalizado. No se pudo construir ningún bloque.");
        }
        await writeCsv(OUTPUT_CSV_PATH, fcfsResults);
        console.log(`\n¡Proceso completado! Resultados guardados en: ${OUTPUT_CSV_PATH}`);
    } catch (error) {
        console.error("\nOcurrió un error:", error.message);
        console.error(error.stack);
    }
}

main();
