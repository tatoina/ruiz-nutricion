// Compat shim para importaciones relativas desde src/components:
// Si hay imports como `import ... from './firebase'` desde un componente,
// esto reexporta todo desde ../Firebase (el archivo canonico).
// Ajusta la ruta si tu archivo real se llama diferente (../firebase o ../Firebase).
export * from "../Firebase";
export { default } from "../Firebase";