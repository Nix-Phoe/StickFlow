// Licences des bibliothèques livrées, calculées au build (scripts/licenses.ts).
declare module 'virtual:licenses' {
  const licenses: Array<{
    name: string;
    version: string;
    license: string;
    author: string | null;
    url: string | null;
    text: string | null;
  }>;
  export default licenses;
}
