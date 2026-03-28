declare module 'decode-dxt' {
  const decodeDXT: (
    data: DataView,
    width: number,
    height: number,
    format: 'dxt1'
  ) => Uint8Array

  export default decodeDXT
}
