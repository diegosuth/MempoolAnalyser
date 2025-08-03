/**
 * =================================================================
 * Archivo: recoleccionminado_final.js
 * Descripción: Versión robusta y optimizada del script.
 * CORRECCIÓN: Ahora calcula el rango de bloques a escanear basándose
 * en la duración de los timestamps, para coincidir con los simuladores.
 *
 * EJECUCIÓN: node recoleccionminadov2.js
 * =================================================================
 */

// --- Dependencias ---
import { ethers } from 'ethers';
import { createObjectCsvWriter } from 'csv-writer';
import fs from 'fs';
import { parse } from 'csv-parse';

// =================================================================
// --- CONFIGURACIÓN ---
// =================================================================

const NODE_URL = 'http://127.0.0.1:8545';
const INPUT_CSV_FOR_RANGE = './mempool_data_sepolia.csv';
const OUTPUT_CSV_PATH = './mined_transactions_data.csv';

const BATCH_SIZE = 70;
const MAX_RETRIES = 10;
const RETRY_DELAY_MS = 1000;
const SECONDS_PER_BLOCK = 12;

// =================================================================
// --- FUNCIÓN DE LECTURA DE CSV ---
// =================================================================
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

// =================================================================
// --- FUNCIÓN PARA PROCESAR UN ÚNICO BLOQUE (CON REINTENTOS) ---
// =================================================================
async function processBlockWithRetries(blockNumber, provider) {
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const block = await provider.getBlock(blockNumber, true);

            if (!block || block.transactions.length === 0) {
                console.log(`Bloque #${blockNumber}: Sin transacciones o no encontrado.`);
                return [];
            }

            const baseFeePerGas = block.baseFeePerGas || 0n;
            let totalBlockRewardWei = 0n;

            const receiptPromises = block.prefetchedTransactions.map(tx => provider.getTransactionReceipt(tx.hash));
            const receipts = await Promise.all(receiptPromises);

            const blockTransactionsData = [];
            for (let i = 0; i < block.prefetchedTransactions.length; i++) {
                const tx = block.prefetchedTransactions[i];
                const receipt = receipts[i];
                if (!receipt) continue;

                const gasUsed = receipt.gasUsed;
                const effectiveGasPrice = receipt.effectiveGasPrice || (tx.gasPrice || 0n);
                const priorityFeePerGas = effectiveGasPrice - baseFeePerGas;
                const gananciaWei = priorityFeePerGas * gasUsed;
                totalBlockRewardWei += gananciaWei;

                blockTransactionsData.push({
                    TransactionHash: tx.hash,
                    TransactionType: tx.type,
                    GasUsed: gasUsed.toString(),
                    MaxPriorityFee: (tx.maxPriorityFeePerGas || 0n).toString(),
                    GananciaxTransaccion: gananciaWei.toString(),
                    BaseFee: baseFeePerGas.toString(),
                    BlockNumber: block.number,
                    BlockGas: '',
                    BlockReward: '',
                    TimeStamp: new Date(block.timestamp * 1000).toISOString(),
                });
            }

            if (blockTransactionsData.length > 0) {
                const lastTx = blockTransactionsData[blockTransactionsData.length - 1];
                lastTx.BlockGas = block.gasUsed.toString();
                lastTx.BlockReward = totalBlockRewardWei.toString();
            }
            
            console.log(`Bloque #${blockNumber}: Procesado con ${block.transactions.length} transacciones.`);
            return blockTransactionsData;

        } catch (blockError) {
            console.error(`Error procesando bloque #${blockNumber} (Intento ${attempt}/${MAX_RETRIES}): ${blockError.message}`);
            if (attempt === MAX_RETRIES) {
                console.error(`Fallo al procesar el bloque #${blockNumber} después de ${MAX_RETRIES} intentos.`);
                return [];
            }
            const delay = RETRY_DELAY_MS * Math.pow(2, attempt - 1);
            console.log(`   Reintentando en ${delay / 1000} segundos...`);
            await new Promise(res => setTimeout(res, delay));
        }
    }
    return [];
}

// =================================================================
// --- SCRIPT PRINCIPAL ---
// =================================================================
async function main() {
    console.log('Iniciando el recolector de transacciones minadas (versión corregida)...');
    try {
        const provider = new ethers.JsonRpcProvider(NODE_URL);
        const network = await provider.getNetwork();
        console.log(`Conectado exitosamente a la red: ${network.name}`);

        console.log(`Leyendo ${INPUT_CSV_FOR_RANGE} para determinar el rango de bloques...`);
        const mempoolTxs = await readCsv(INPUT_CSV_FOR_RANGE);
        if (mempoolTxs.length === 0) throw new Error("El archivo de entrada está vacío.");
        
        // --- CORRECCIÓN CLAVE: Calcular rango basado en TIMESTAMPS ---
        let startBlock = Infinity;
        let minTimestamp = Infinity;
        let maxTimestamp = -Infinity;

        for (const tx of mempoolTxs) {
            const blockNum = parseInt(tx.NetworkBlock, 10);
            const timestamp = Date.parse(tx.TimeStamp);

            if (!isNaN(blockNum) && blockNum < startBlock) {
                startBlock = blockNum;
            }
            if (!isNaN(timestamp)) {
                if (timestamp < minTimestamp) minTimestamp = timestamp;
                if (timestamp > maxTimestamp) maxTimestamp = timestamp;
            }
        }

        if (startBlock === Infinity || minTimestamp === Infinity) {
            throw new Error("No se encontraron bloques o timestamps válidos en el archivo de entrada.");
        }

        const durationInSeconds = (maxTimestamp - minTimestamp) / 1000;
        const expectedBlocks = Math.round(durationInSeconds / SECONDS_PER_BLOCK);
        const endBlock = startBlock + expectedBlocks;
        // --- FIN DE LA CORRECCIÓN ---

        console.log(`Duración de datos: ${durationInSeconds.toFixed(2)} segundos.`);
        console.log(`Rango de bloques a analizar: Desde ${startBlock} hasta ${endBlock} (~${expectedBlocks} bloques)`);
        
        const fileExists = fs.existsSync(OUTPUT_CSV_PATH);
        const csvWriter = createObjectCsvWriter({
            path: OUTPUT_CSV_PATH,
            header: [
                { id: 'TransactionHash', title: 'TransactionHash' },
                { id: 'TransactionType', title: 'TransactionType' },
                { id: 'GasUsed', title: 'GasUsed' },
                { id: 'MaxPriorityFee', title: 'MaxPriorityFee' },
                { id: 'GananciaxTransaccion', title: 'GananciaxTransaccion' },
                { id: 'BaseFee', title: 'BaseFee' },
                { id: 'BlockNumber', title: 'BlockNumber' },
                { id: 'BlockGas', title: 'BlockGas' },
                { id: 'BlockReward', title: 'BlockReward' },
                { id: 'TimeStamp', title: 'TimeStamp' },
            ],
            append: fileExists
        });
        
        for (let i = startBlock; i <= endBlock; i += BATCH_SIZE) {
            const batchStart = i;
            const batchEnd = Math.min(i + BATCH_SIZE - 1, endBlock);
            console.log(`\n--- Procesando lote de bloques: ${batchStart} a ${batchEnd} ---`);
            
            const blockPromises = [];
            for (let blockNumber = batchStart; blockNumber <= batchEnd; blockNumber++) {
                blockPromises.push(processBlockWithRetries(blockNumber, provider));
            }
            
            const resultsFromBatch = await Promise.all(blockPromises);
            const flattenedResults = resultsFromBatch.flat();

            if (flattenedResults.length > 0) {
                flattenedResults.sort((a, b) => {
                    if (a.BlockNumber !== b.BlockNumber) return a.BlockNumber - b.BlockNumber;
                    return a.TransactionHash.localeCompare(b.TransactionHash);
                });
                await csvWriter.writeRecords(flattenedResults);
                console.log(`--- Lote completado. Se escribieron ${flattenedResults.length} transacciones en el archivo. ---`);
            } else {
                console.log(`--- Lote completado. No se encontraron nuevas transacciones para escribir. ---`);
            }
        }
        console.log(`\n¡Proceso completado! Resultados guardados en: ${OUTPUT_CSV_PATH}`);
    } catch (error) {
        console.error("\nOcurrió un error crítico:", error.message);
        console.error(error.stack);
    }
}

main();
