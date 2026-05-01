/**
 * Build a deploy-ready frontend copy with versioned local asset URLs for cache busting.
 */

const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..', '..')
const SOURCE_DIR = path.join(ROOT_DIR, 'view')
const OUTPUT_ROOT = path.join(ROOT_DIR, '.deploy')
const OUTPUT_DIR = path.join(OUTPUT_ROOT, 'view')
const VERSION_FILE = path.join(OUTPUT_ROOT, 'frontend-version.txt')

/**
 * Resolve the frontend release version from env, git, or a timestamp fallback.
 * @returns {string}
 */
function resolveFrontendVersion() {
    const explicitVersion = sanitizeVersion(process.env.PFB_FRONTEND_VERSION || '')
    if (explicitVersion) return explicitVersion

    try {
        const gitVersion = execSync('git rev-parse --short HEAD', {
            cwd: ROOT_DIR,
            encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'ignore']
        }).trim()
        const sanitizedGitVersion = sanitizeVersion(gitVersion)
        if (sanitizedGitVersion) return sanitizedGitVersion
    } catch (error) {
        // Fall back to a timestamp when git metadata is unavailable.
    }

    return String(Date.now())
}

/**
 * Remove characters that are unsafe in a query-string cache key.
 * @param {string} value - Candidate version string.
 * @returns {string}
 */
function sanitizeVersion(value) {
    return String(value).trim().replace(/[^a-zA-Z0-9._-]+/g, '-')
}

/**
 * Keep source-only documentation out of the generated deploy artifact tree.
 * @param {string} sourcePath - Candidate source path.
 * @returns {boolean}
 */
function shouldCopyReleaseEntry(sourcePath) {
    return path.extname(sourcePath).toLowerCase() !== '.md'
}

/**
 * Replace local CSS and JS references with a versioned query string.
 * @param {string} html - Source HTML contents.
 * @param {string} version - Deploy version to append.
 * @returns {string}
 */
function rewriteAssetUrls(html, version) {
    return html.replace(/((?:href|src)=['"])(?!https?:|\/\/|data:)([^'"]+\.(?:css|js))(\?[^'"]*)?(['"])/g, (match, prefix, assetPath, query = '', suffix) => {
        const params = new URLSearchParams(query.replace(/^\?/, ''))
        params.set('v', version)
        return `${prefix}${assetPath}?${params.toString()}${suffix}`
    })
}

/**
 * Read, rewrite, and persist every HTML file in the deploy output tree.
 * @param {string} dirPath - Directory to walk.
 * @param {string} version - Deploy version to append.
 * @returns {void}
 */
function rewriteHtmlFiles(dirPath, version) {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true })

    for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name)
        if (entry.isDirectory()) {
            rewriteHtmlFiles(fullPath, version)
            continue
        }

        if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== '.html') {
            continue
        }

        const currentHtml = fs.readFileSync(fullPath, 'utf8')
        const nextHtml = rewriteAssetUrls(currentHtml, version)
        fs.writeFileSync(fullPath, nextHtml)
    }
}

/**
 * Create a clean deploy tree, rewrite HTML shell assets, and persist the release version.
 * @returns {void}
 */
function buildFrontendRelease() {
    const version = resolveFrontendVersion()

    fs.rmSync(OUTPUT_ROOT, { recursive: true, force: true })
    fs.mkdirSync(OUTPUT_ROOT, { recursive: true })
    fs.cpSync(SOURCE_DIR, OUTPUT_DIR, {
        recursive: true,
        filter: shouldCopyReleaseEntry
    })

    rewriteHtmlFiles(OUTPUT_DIR, version)
    fs.writeFileSync(VERSION_FILE, `${version}\n`)

    console.log(`Built frontend release ${version} at ${OUTPUT_DIR}`)
}

buildFrontendRelease()