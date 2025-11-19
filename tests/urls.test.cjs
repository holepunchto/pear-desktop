const { readdir, stat, readFile } = require('fs/promises')
const test = require('brittle')
const path = require('path')
const https = require('https')

test('check that all urls can be reached', async (t) => {
  const docs = await readMarkdownFiles()

  let urls = await Promise.all(
    docs.map(async (doc) => {
      const content = (await readFile(doc)).toString()
      const urlRegex = /(?<url>https?:\/\/[^\s)"'`]+)/gi
      return content.match(urlRegex)
    })
  )
  // hostnames which are expected to return a 403 when testing
  const FORBIDDEN_HOSTS = [
    "https://www.npmjs.com",
    "https://keet.io",
    "https://en.wikipedia.org"
  ]

  urls = urls
    .flat()
    .filter((u) => u !== null)
    .filter((u) => u !== "http://*")
    .filter((u) => u !== "https://*")
    .filter((u) => !u.startsWith("http://localhost"))

  const cache = new Map()
  const checkUrlResults = await Promise.all(
    urls.map(async (url) => {
      if (cache.get(url)) return cache.get(url)
      const result = await checkUrl(url.trim())
      cache.set(url, result)
      return result
    })
  )

  for (const checkUrlResult of checkUrlResults) {
    if (checkUrlResult.pass) {
      t.pass(`${checkUrlResult.url} returned code ${checkUrlResult.res.statusCode}`)
    } else {
      if (checkUrlResult.res) {
        if (FORBIDDEN_HOSTS.some(host => checkUrlResult.url.startsWith(host)) && checkUrlResult.res.statusCode === 403) {
          t.pass(`${checkUrlResult.url} returned code ${checkUrlResult.res.statusCode} (expected)`)
        } else {
          t.fail(`${checkUrlResult.url} returned code ${checkUrlResult.res.statusCode}`)
        }
      } else if (checkUrlResult.err) {
        t.fail(`${checkUrlResult.url} failed with error "${checkUrlResult.err}"`)
      }
    }
  }
})

async function readMarkdownFiles(folderPath = path.join(__dirname, '../vendor/pear-docs')) {
  let result = []
  const files = await readdir(folderPath)

  for (const file of files) {
    const filePath = path.join(folderPath, file)
    const stats = await stat(filePath)

    if (!filePath.includes('node_modules') && stats.isDirectory()) {
      result = result.concat(await readMarkdownFiles(filePath))
    } else if (path.extname(filePath) === '.md') {
      result.push(filePath)
    }
  }

  return result
}

function checkUrl(url) {
  return new Promise((resolve, reject) => {
    try {
      https
        .get(url, (res) => {
          if (res.statusCode >= 200 && res.statusCode < 400) {
            resolve({ pass: true, res, url })
          } else {
            resolve({ pass: false, res, url })
          }
        })
        .on('error', (err) => {
          resolve({ pass: false, res: null, err, url })
        })
    } catch (err) {
      resolve({ pass: false, err, res: null, url })
    }
  })
}
