import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const target = join(root, 'src/config/providers.json')
const source = join(root, 'src/config/providers.example.json')

if (!existsSync(target)) {
  copyFileSync(source, target)
  console.log('Created src/config/providers.json from providers.example.json')
}
