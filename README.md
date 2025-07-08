# MempoolAnalyser
Repositorio para automatizar proceso de recoleccion de transacciones, test de algoritmos y comparación de resultados
# Procedimiento general
## Paso 1: Recolectar las siguientes columnas de información de la mempool:
TransactionHash,TransactionType,GasLimit,MaxPriorityFee,GananciaxTransaccion,TimeStamp,NetworkBlock,PeerCount <br> 
Todo aquello relacionado a ganancias va a estar por defecto en Wei.

## Paso 2: Programar y usar algoritmos greedy y fcfs y que el csv output tenga las siguientes columnas:
TransactionHash,TransactionType,GasLimit,MaxPriorityFee,GananciaxTransaccion,TimeSta
mp,NetworkBlock,BlockNumber,BlockReward,BlockGas
-BlockReward sea la sumatoria de las ganancias de cada transaccion, GananciaxTransaccion y BlockReward se colocan en Gwei. BlockReward y
BlockGas solo aparecen en la fila de la ultima transaccion del bloque.
-El algoritmo greedy utiliza MaxHeap para ordenar las transacciones a medida que las va parseando del csv, y se realiza una división entre MaxPriorityFee y GasLimit, dónde los valores más altos son aquellos deseados.
-El algoritmo fcfs va incluyendo en los bloques transacciones dependiendo de su orden de llegada.
## Paso2.1: Los algoritmos tienen las siguientes características:
-Una vez que una transaccion es incluida en un bloque, deja de ser considerada para
bloques futuros.

-Si una transaccion no es incluida en un bloque, puede ser considerada para bloques
futuros hasta que sea incorporada en uno, después de eso deja de ser considerada.

-Existe un target de bloques que cumplan la regla de bloques cada 12
segundos (43200segundos / 12 bloques para 12 horas), así al hacer la comparación entre
algoritmos vs red real es mas realista.(Actualmente la cantidad de bloques de cada
algoritmo supera con diferencia a la real debido a la diferencia de volumen de datos).

-Solo se pueden ver t segundos adelante en cada bloque(por ejemplo si la primera
transaccion ocurre en t=20, el bloque se arma unicamente con transacciones
t<=28).  

-Existe una lista, donde se almacenan todas las transacciones que cumplan el requisito de la ventana de tiempo, y si son incluidas por el
algoritmo que se eliminen de la lista. Así las que no son incorporadas en un bloque son
consideradas en un bloque futuro hasta que sean incluidas.

-Se incorpora característica real red Ethereum: Todos los bloques tienen un target de 15
millones de gas, pero en casos donde se encuentre cerca del target y la transacción
siguiente a incorporarse lo superaría, se incluye igualmente y se cierra el bloque con esa
transacción. Igualmente existe un hard cap de 30 millones.

-Una vez construidos ambos csv, se realiza un test de una sumatoria de la columna BlockReward y
se revisa que ambos den el mismo resultado, ya que a través de la lógica incorporada
deberían ser equivalentes.

## Paso3: Conseguir datos de red real que vayan desde NetworkBlock0 hasta NetworkBlock i-1, y que contenga las siguientes columnas:
TransactionHash,TransactionType,GasUsed,MaxPriorityFee,GananciaxTransaccion(post
BaseFee),BaseFee,BlockNumber,BlockGas,BlockReward(como sumatoria de las
transacciones contenidas en un bloque, no como el block reward que aparece en
EtherScans). El valor de BlockReward y BlockGas aparecen solamente en la fila de la
ultima transaccion de cada bloque. Al igual que en los algoritmos, se hace la conversión de Wei a Gwei para las casillas de BlockReward y GananciaxTransaccion
