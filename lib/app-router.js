/* eslint-env browser */

customElements.define('app-nav', class AppNav extends HTMLElement {
  #active = null
  constructor () {
    super()
    const root = this.attachShadow({ mode: 'open' })
    root.innerHTML = `<style>
      :host {
        display: block
      }
      ::slotted(a) {
        display: block
      }
    </style><slot></slot>`
  }

  connectedCallback () {
    this.#active = getComputedStyle(this).getPropertyValue('--active').trim()
  }

  sub (target, href) {
    const fragments = this.querySelectorAll('a')
    for (const a of fragments) {
      if (a.getAttribute('href') === target) {
        if (a.parentElement.tagName === 'SPAN') {
          return href[0] === '?' ? target + href : href
        }

        const wrapper = document.createElement('span')
        wrapper.style.display = 'inline-flex'
        wrapper.style.gap = '0.5rem'

        a.replaceWith(wrapper)
        wrapper.appendChild(a)

        const separator = document.createElement('span')
        separator.style.fontSize = '1.1em'
        separator.style.color = this.#active
        separator.textContent = '→ '
        wrapper.appendChild(separator)

        const injected = document.createElement('a')
        injected.textContent = (href[0] === '?') ? href.slice(1) : href
        href = href[0] === '?' ? target + href : href
        injected.href = href
        wrapper.appendChild(injected)

        return href
      }
    }
  }

  set active (href) {
    for (const a of this.querySelectorAll('a')) {
      if (a.getAttribute('href') === href) a.style.color = this.#active
      else a.style.color = ''
    }
  }

  get active () {
    return this.querySelector('a[data-active]')?.getAttribute('href') || null
  }
})

customElements.define('app-router', class AppRouter extends HTMLElement {
  constructor () {
    super()
    this.routes = {}
    this.page = null
    this.fragment = null
    this.query = null
    this.nav = null
  }

  unload () {
    for (const element of Object.values(this.routes)) element?.unload && element.unload()
  }

  remap (page) {
    const map = {
      '/migration': '/guide/migration',
      '/doc': '/documentation',
      'building-blocks': 'vendor/pear-docs/building-blocks',
      guide: 'vendor/pear-docs/guide',
      helpers: 'vendor/pear-docs/helpers',
      howto: 'vendor/pear-docs/howto',
      reference: 'vendor/pear-docs/reference',
      tools: 'vendor/pear-docs/tools',
      apps: 'vendor/pear-docs/apps',
      examples: 'vendor/pear-docs/examples',
      'bare-reference': 'vendor/pear-docs/bare-reference'
    }

    let pathname = map[page] ? map[page] : page
    console.log(page, '->', pathname)
    pathname = pathname
      .split('/')
      .map((part, i, parts) => {
        if (map[part] && parts[i - 1] !== 'vendor' && parts[i - 1] !== 'pear-docs' && parts[i - 2] !== '..') {
          return map[part]
        }
        return part
      })
      .join('/')

    console.log(page, '->', pathname)
    if (pathname.startsWith('/vendor/pear-docs') && pathname.includes('.') === false) pathname += '.md'
    else { return pathname }
  }

  async load (pathname = '/', opts = {}) {
    pathname = this.remap(pathname)
    if (this.page === pathname && this.fragment === opts.fragment && this.query === opts.query) return
    this.page = pathname
    this.fragment = opts.fragment
    let found = false
    for (const [route, element] of Object.entries(this.routes)) {
      if (pathname === route || pathname.startsWith('/documentation')) {
        found = true
        const page = pathname.slice(route.length) || '/'
        this.unload()
        document.documentElement.scrollTop = 0
        this.dataset.load = element.tagName.toLowerCase()
        const sub = await element.load(page, opts)
        if (sub) {
          this.nav.active = this.nav.sub(pathname, sub)
          if (!opts.back) {
            // inject /<page> so back() from /<page>?link goes to /<page>
            history.pushState({ pathname, fragment: opts.fragment }, null, pathname)
          }
        } else {
          this.nav.active = pathname
        }

        const isDocumentationPage = pathname.startsWith('/documentation')
        const fragment = opts.fragment
        const shouldShowSpecificSection = fragment && isDocumentationPage
        if (shouldShowSpecificSection) {
          const element = this.routes['/documentation'].shadowRoot.getElementById(fragment)
          element.scrollIntoView()
          const elementY = Math.floor(element.getBoundingClientRect().y)
          const pearHeaderHeight = 170
          const extraScroll = 80
          const isUnderPearHeader = elementY < pearHeaderHeight + extraScroll
          if (isUnderPearHeader) {
            window.scrollBy(0, -1 * (pearHeaderHeight + extraScroll - elementY))
          }
        }

        if (!opts.back) history.pushState({ pathname, fragment: opts.fragment, query: opts.query }, null, this.nav.active)
        break
      }
    }
    if (!found) this.notFound(pathname)
  }

  notFound (req) {
    this.unload()
    const element = this.routes['not-found']
    element.setAttribute('page', req)
    element.load()
  }

  link (evt) {
    if (evt.target?.tagName !== 'A') return
    evt.preventDefault()
    if (evt.target.origin !== location.origin) return window.open(evt.target.href)
    const { tagName } = evt.target.getRootNode().host || {}
    const route = tagName ? this.getAttribute(tagName) : ''
    this.load(route + evt.target.pathname, { fragment: evt.target.hash.slice(1), query: evt.target.search.slice(1) }).catch(console.error)
  }

  connectedCallback () {
    this.nav = this.querySelector(this.dataset.nav)

    for (const { name, value } of Array.from(this.attributes)) {
      if (name.startsWith('data-')) continue
      this.routes[value] = this.querySelector(name)
      this.routes[value].router = this
    }

    this.addEventListener('click', (evt) => this.link(evt))

    window.addEventListener('popstate', (evt) => {
      this.load(evt.state?.pathname, { back: true, fragment: evt.state?.fragment, query: evt.state?.query }).catch(console.error)
    })

    window.addEventListener('load', () => {
      const page = this.remap(Pear.config.route || '/')
      const opts = { fragment: Pear.config.fragment, query: Pear.config.query }
      this.load(page, opts).catch(console.error)
      Pear.wakeups(({ data }) => {
        Pear.Window.self.focus({ steal: true }).catch(console.error)
        const page = '/' + (data || '')
        this.load(page).catch(console.error) // TODO: frag + query
      })
    })
  }
})
