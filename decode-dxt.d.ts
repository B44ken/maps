declare module 'decode-dxt' {
  export default (data: DataView,width: number,height: number,format: 'dxt1') => Uint8Array
}

declare module '*.cjs' {
  const value: any
  export default value
}
