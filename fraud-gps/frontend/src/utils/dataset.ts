export function sameDataset(...versions: string[]) {
  if (new Set(versions).size > 1)
    throw new Error('The dataset changed. Reload the workspace to continue.');
}
