export const SERVER = 'http://localhost:3001'

function getStoredToken() {
  try {
    return sessionStorage.getItem('cleancutz_token') || ''
  } catch {
    return ''
  }
}


export function setToken(token) {
  try {
    if (!token) sessionStorage.removeItem('cleancutz_token')
    else sessionStorage.setItem('cleancutz_token', token)
  } catch {
    // ignore
  }
}


export function getAuthHeaders() {
  const token = getStoredToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

export async function apiJson(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    headers: {
      ...getAuthHeaders(),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  })


  const contentType = res.headers.get('content-type') || ''
  const text = await res.text()
  const data = contentType.includes('application/json') ? JSON.parse(text || '{}') : { error: text }

  if (!res.ok) {
    throw new Error(data?.error || `Request failed (${res.status})`)
  }

  return data
}

export async function apiRaw(path, { method = 'GET', body, headers = {} } = {}) {
  const res = await fetch(`${SERVER}${path}`, {
    method,
    headers: {
      ...getAuthHeaders(),
      ...headers
    },
    body
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Request failed (${res.status})`)
  }

  return res
}

