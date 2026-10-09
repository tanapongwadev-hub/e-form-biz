import { existsSync } from "node:fs"
import { join } from "node:path"

export const resolveFormFile = (pathname: string, formsDirectory: string) => {
  const formCode = pathname.match(/^\/forms\/([A-Za-z0-9_-]+)\/?$/)?.[1]
  if (!formCode) return

  const file = join(formsDirectory, `${formCode}.html`)
  return existsSync(file) ? file : undefined
}
