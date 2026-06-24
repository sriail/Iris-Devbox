# Testing Website And Framworks (skill-testing-websites-and-frameworks.md)

Description: Test websites and web based frameworks without a full graphical browser installed to verify the user's request or use the web.

## Overview

Test websites and web applications in Alpine Linux environments without a graphical browser installed. This guide provides command-line tools and techniques for verifying HTTP behavior, parsing HTML, validating responses, and testing APIs — all from the terminal. Instead of visual inspection, you verify correctness through structured output, HTTP status codes, response headers, and DOM structure analysis.

## When to Use

- Testing websites in containerized or minimal Alpine environments
- CI/CD pipelines without browser dependencies
- Server environments where graphical browsers cannot be installed
- Validating API responses and HTML structure
- Debugging HTTP behavior without a browser
- Automated testing in resource-constrained environments

**When NOT to use:** When you need visual rendering verification, CSS layout testing, JavaScript-heavy SPA interaction testing, or accessibility tree inspection that requires a real browser engine.

## Prerequisites for Alpine Linux

### Essential Packages

```bash
# HTTP clients
apk add curl wget

# HTML/XML parsing and validation
apk add libxml2-utils htmltidy

# Text processing
apk add jq grep sed awk

# Network diagnostics
apk add nmap netcat-openbsd

# JavaScript runtime (for DOM simulation)
apk add nodejs npm
```

### Optional Packages

```bash
# JSON processing
apk add jq

# DNS debugging
apk add bind-tools

# SSL/TLS verification
apk add openssl

# Performance measurement
apk add bash  # for timing with 'time' builtin
```

## Core Testing Approaches

### 1. HTTP Behavior Testing

Verify that endpoints respond correctly without rendering anything.

```bash
# Basic status code check
curl -s -o /dev/null -w "%{http_code}" https://example.com/api/health
# Expected: 200

# Full response headers
curl -sI https://example.com
# Check: Content-Type, Cache-Control, X-Frame-Options, etc.

# JSON API response validation
curl -s https://example.com/api/users | jq '.[0] | {id, name, email}'
# Verify: Structure matches expected schema

# POST request with payload
curl -s -X POST https://example.com/api/tasks \
  -H "Content-Type: application/json" \
  -d '{"title":"Test task","status":"pending"}' \
  | jq '{id, title, status}'
```

**Test Script Template:**

```bash
#!/bin/sh
# test_api_endpoint.sh

URL="https://example.com/api/tasks"
EXPECTED_STATUS=200

STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$URL")

if [ "$STATUS" = "$EXPECTED_STATUS" ]; then
  echo "✓ PASS: $URL returned $STATUS"
  exit 0
else
  echo "✗ FAIL: $URL returned $STATUS (expected $EXPECTED_STATUS)"
  exit 1
fi
```

### 2. HTML Structure Validation

Parse and validate HTML without rendering.

```bash
# Validate HTML syntax
curl -s https://example.com | tidy -q -e 2>&1

# Extract all links
curl -s https://example.com | grep -oP 'href="[^"]+"' | sed 's/href="//;s/"//'

# Check for specific elements
curl -s https://example.com | grep -q '<title>' && echo "Title tag found" || echo "Missing title"

# Count specific elements
curl -s https://example.com | grep -c '<img'

# Extract meta tags
curl -s https://example.com | grep -oP '<meta[^>]+>' | head -5
```

**HTML Validation Script:**

```bash
#!/bin/sh
# validate_html.sh

URL="$1"
RESPONSE=$(curl -s "$URL")

# Check for required elements
check_element() {
  local element="$1"
  local description="$2"
  
  if echo "$RESPONSE" | grep -qi "$element"; then
    echo "✓ Found: $description"
    return 0
  else
    echo "✗ Missing: $description"
    return 1
  fi
}

echo "Validating: $URL"
echo "-------------------"

check_element "<!DOCTYPE html>" "DOCTYPE declaration"
check_element "<html" "HTML tag"
check_element "<head>" "Head section"
check_element "<body>" "Body section"
check_element "<title>" "Title tag"
check_element 'meta.*charset' "Charset meta tag"
check_element 'meta.*viewport' "Viewport meta tag"

# Check for common issues
if echo "$RESPONSE" | grep -qi "error\|warning\|exception"; then
  echo "⚠ Possible error messages in HTML"
fi
```

### 3. JavaScript/DOM Simulation with Node.js

Use Node.js with minimal libraries to simulate DOM parsing and test JavaScript behavior.

```bash
# Install required packages
npm install --save-dev jsdom cheerio axios
```

**DOM Testing Script (test_dom.js):**

```javascript
const { JSDOM } = require('jsdom');
const axios = require('axios');

async function testPageStructure(url) {
  try {
    const response = await axios.get(url);
    const dom = new JSDOM(response.data);
    const document = dom.window.document;

    console.log(`Testing: ${url}`);
    console.log('-------------------');

    // Test title
    const title = document.querySelector('title')?.textContent;
    console.log(`Title: ${title || 'MISSING'}`);

    // Test headings
    const headings = document.querySelectorAll('h1, h2, h3');
    console.log(`Headings found: ${headings.length}`);

    // Test links
    const links = document.querySelectorAll('a[href]');
    console.log(`Links found: ${links.length}`);

    // Test images have alt text
    const images = document.querySelectorAll('img');
    let imagesWithoutAlt = 0;
    images.forEach(img => {
      if (!img.getAttribute('alt')) imagesWithoutAlt++;
    });
    console.log(`Images without alt: ${imagesWithoutAlt}/${images.length}`);

    // Test forms
    const forms = document.querySelectorAll('form');
    forms.forEach((form, i) => {
      const action = form.getAttribute('action') || 'none';
      const method = form.getAttribute('method') || 'GET';
      console.log(`Form ${i + 1}: ${method} ${action}`);
    });

    // Check for specific elements
    const requiredSelectors = [
      'nav',
      'main',
      'footer'
    ];

    requiredSelectors.forEach(selector => {
      const found = document.querySelector(selector);
      console.log(`${selector}: ${found ? 'FOUND' : 'MISSING'}`);
    });

  } catch (error) {
    console.error(`Error fetching ${url}:`, error.message);
    process.exit(1);
  }
}

// Usage
const url = process.argv[2] || 'http://localhost:3000';
testPageStructure(url);
```

**Run the test:**
```bash
node test_dom.js https://example.com
```

### 4. API Contract Testing

Verify API responses match expected schemas without a browser.

**Contract Test Script (test_api_contract.sh):**

```bash
#!/bin/sh
# test_api_contract.sh

BASE_URL="${1:-http://localhost:3000/api}"

test_endpoint() {
  local endpoint="$1"
  local method="${2:-GET}"
  local expected_fields="$3"
  local data="$4"
  
  echo "Testing: $method $endpoint"
  
  if [ "$method" = "GET" ]; then
    RESPONSE=$(curl -s "$BASE_URL$endpoint")
  else
    RESPONSE=$(curl -s -X "$method" \
      -H "Content-Type: application/json" \
      -d "$data" \
      "$BASE_URL$endpoint")
  fi
  
  # Check if response is valid JSON
  if ! echo "$RESPONSE" | jq empty 2>/dev/null; then
    echo "  ✗ Invalid JSON response"
    return 1
  fi
  
  # Check for expected fields
  for field in $expected_fields; do
    if echo "$RESPONSE" | jq -e ".$field" > /dev/null 2>&1; then
      echo "  ✓ Field '$field' present"
    else
      echo "  ✗ Field '$field' missing"
      return 1
    fi
  done
  
  echo "  ✓ All fields present"
  return 0
}

# Run tests
FAILURES=0

test_endpoint "/tasks" "GET" "data pagination" || FAILURES=$((FAILURES + 1))
test_endpoint "/tasks" "POST" "id title status" '{"title":"Test","status":"pending"}' || FAILURES=$((FAILURES + 1))

echo "-------------------"
if [ $FAILURES -eq 0 ]; then
  echo "All tests passed"
  exit 0
else
  echo "$FAILURES test(s) failed"
  exit 1
fi
```

### 5. Security Header Verification

Check for security-related HTTP headers.

```bash
#!/bin/sh
# test_security_headers.sh

URL="$1"

echo "Security Headers for: $URL"
echo "-------------------"

HEADERS=$(curl -sI "$URL")

check_header() {
  local header="$1"
  local description="$2"
  
  if echo "$HEADERS" | grep -qi "$header:"; then
    value=$(echo "$HEADERS" | grep -i "$header:" | cut -d: -f2- | xargs)
    echo "✓ $description: $value"
    return 0
  else
    echo "✗ Missing: $description"
    return 1
  fi
}

check_header "X-Content-Type-Options" "Content-Type sniffing protection"
check_header "X-Frame-Options" "Clickjacking protection"
check_header "X-XSS-Protection" "XSS protection"
check_header "Strict-Transport-Security" "HSTS"
check_header "Content-Security-Policy" "Content Security Policy"
check_header "Referrer-Policy" "Referrer Policy"

# Check for HTTPS
if echo "$URL" | grep -q "^https://"; then
  echo "✓ Using HTTPS"
else
  echo "⚠ Not using HTTPS"
fi
```

## The Headless Testing Workflow

### For HTTP/API Issues

```
1. ISOLATE
   └── Identify the specific endpoint or request causing issues
       └── Test with minimal curl command

2. VERIFY
   ├── Check HTTP status code
   ├── Verify response headers
   ├── Validate response body structure
   └── Check timing (is it slow?)

3. DIAGNOSE
   ├── 4xx → Client is sending wrong data or wrong URL
   ├── 5xx → Server error (check server logs)
   ├── CORS → Check Origin and Access-Control headers
   ├── Timeout → Check server response time
   └── Invalid JSON → Check response body

4. FIX & VERIFY
   └── Fix the issue, re-run the curl command, confirm the response
```

### For HTML Structure Issues

```
1. EXTRACT
   └── Fetch the HTML with curl

2. PARSE
   ├── Run through tidy for validation
   ├── Use grep to find specific elements
   └── Use Node.js with jsdom for complex parsing

3. COMPARE
   ├── Compare actual structure vs expected
   ├── Check for required elements
   └── Verify element attributes

4. FIX & VERIFY
   └── Fix the HTML, re-fetch, confirm structure
```

### For Performance Issues

```
1. MEASURE
   └── Use curl with timing output

2. ANALYZE
   ├── Check response size
   ├── Check time to first byte
   └── Check total time

3. IDENTIFY
   ├── Large responses → Optimize payload
   ├── Slow TTFB → Server-side issue
   └── Many requests → Reduce HTTP calls

4. FIX & MEASURE
   └── Apply optimization, re-measure, compare
```

## Performance Measurement Without a Browser

```bash
# Detailed timing information
curl -w "\n
  time_namelookup:  %{time_namelookup}s\n
  time_connect:     %{time_connect}s\n
  time_appconnect:  %{time_appconnect}s\n
  time_pretransfer: %{time_pretransfer}s\n
  time_redirect:    %{time_redirect}s\n
  time_starttransfer: %{time_starttransfer}s\n
  time_total:       %{time_total}s\n
  size_download:    %{size_download} bytes\n
  speed_download:   %{speed_download} bytes/s\n
" -s -o /dev/null https://example.com

# Response size check
curl -s https://example.com | wc -c

# Count external resources (requires HTML parsing)
curl -s https://example.com | grep -oP '(src|href)="[^"]+"' | wc -l
```

**Performance Test Script:**

```bash
#!/bin/sh
# test_performance.sh

URL="$1"
MAX_TTFB=0.5  # 500ms max time to first byte
MAX_TOTAL=2.0  # 2s max total time
MAX_SIZE=500000  # 500KB max response size

echo "Performance Test: $URL"
echo "-------------------"

TIMING=$(curl -w "%{time_starttransfer} %{time_total} %{size_download}" -s -o /dev/null "$URL")

TTFB=$(echo "$TIMING" | awk '{print $1}')
TOTAL=$(echo "$TIMING" | awk '{print $2}')
SIZE=$(echo "$TIMING" | awk '{print $3}')

echo "Time to First Byte: ${TTFB}s (max: ${MAX_TTFB}s)"
echo "Total Time: ${TOTAL}s (max: ${MAX_TOTAL}s)"
echo "Response Size: ${SIZE} bytes (max: ${MAX_SIZE} bytes)"

FAILURES=0

if [ $(echo "$TTFB > $MAX_TTFB" | bc -l) -eq 1 ]; then
  echo "✗ TTFB exceeds threshold"
  FAILURES=$((FAILURES + 1))
fi

if [ $(echo "$TOTAL > $MAX_TOTAL" | bc -l) -eq 1 ]; then
  echo "✗ Total time exceeds threshold"
  FAILURES=$((FAILURES + 1))
fi

if [ "$SIZE" -gt "$MAX_SIZE" ]; then
  echo "✗ Response size exceeds threshold"
  FAILURES=$((FAILURES + 1))
fi

if [ $FAILURES -eq 0 ]; then
  echo "✓ All performance checks passed"
  exit 0
else
  echo "✗ $FAILURES performance check(s) failed"
  exit 1
fi
```

## Writing Test Plans for Headless Testing

For complex testing scenarios, write structured test plans:

```markdown
## Test Plan: Task API Endpoints

### Environment
- Base URL: http://localhost:3000/api
- Test data: 3 pre-existing tasks

### HTTP Behavior Tests

1. GET /tasks
   - Expected: 200 status code
   - Expected: JSON response with "data" and "pagination" fields
   - Expected: "data" is an array
   - Check: Response time < 500ms

2. POST /tasks
   - Payload: {"title":"New Task","status":"pending"}
   - Expected: 201 status code
   - Expected: Response includes "id" field
   - Expected: "id" is a string
   - Check: Response time < 500ms

3. GET /tasks/:id
   - Use ID from previous test
   - Expected: 200 status code
   - Expected: Response matches created task
   - Check: Title and status match input

4. PATCH /tasks/:id
   - Payload: {"status":"completed"}
   - Expected: 200 status code
   - Expected: Only "status" field changed
   - Check: "updatedAt" field is present and newer

5. DELETE /tasks/:id
   - Expected: 204 status code
   - Expected: Empty response body
   - Check: Subsequent GET returns 404

### Verification
- [ ] All status codes match expectations
- [ ] All response structures are correct
- [ ] All response times are within limits
- [ ] No error messages in responses
```

**Automated Test Script (run_test_plan.sh):**

```bash
#!/bin/sh
# run_test_plan.sh

BASE_URL="http://localhost:3000/api"
PASS=0
FAIL=0

test_case() {
  local name="$1"
  local command="$2"
  local expected_status="$3"
  
  echo "Test: $name"
  
  RESPONSE=$(eval "$command" 2>&1)
  STATUS=$(echo "$RESPONSE" | head -1)
  
  if [ "$STATUS" = "$expected_status" ]; then
    echo "  ✓ PASS (Status: $STATUS)"
    PASS=$((PASS + 1))
  else
    echo "  ✗ FAIL (Expected: $expected_status, Got: $STATUS)"
    FAIL=$((FAIL + 1))
  fi
}

# Run test cases
test_case "GET /tasks returns 200" \
  "curl -s -o /dev/null -w '%{http_code}' $BASE_URL/tasks" \
  "200"

test_case "POST /tasks returns 201" \
  "curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' -d '{\"title\":\"Test\",\"status\":\"pending\"}' $BASE_URL/tasks" \
  "201"

# Add more test cases...

echo "-------------------"
echo "Results: $PASS passed, $FAIL failed"

if [ $FAIL -eq 0 ]; then
  exit 0
else
  exit 1
fi
```

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We need a browser to test this" | Most HTTP/API behavior can be tested with curl. Only visual rendering requires a browser. |
| "HTML validation isn't necessary" | Invalid HTML causes inconsistent rendering across browsers and breaks parsers. |
| "Performance testing needs a browser" | TTFB and response size can be measured with curl. Only rendering performance needs a browser. |
| "Security headers don't matter for internal apps" | Security headers prevent many common attacks regardless of audience. |
| "We'll test manually later" | Automated tests catch regressions. Manual testing doesn't scale. |
| "The API works in Postman" | Postman is a GUI for HTTP requests. curl tests are reproducible and automatable. |
| "Node.js is too heavy for Alpine" | Node.js is available in Alpine repos and provides powerful DOM simulation. |

## Red Flags

- No HTTP status code validation
- No response body structure validation
- No security header checks
- No performance measurements
- Testing only with GUI tools (Postman, browser)
- No automated test scripts
- Ignoring HTML validation warnings
- No check for required HTML elements
- No timing/performance thresholds
- Testing only happy paths, not error cases

## Verification

After creating headless tests:

- [ ] All critical endpoints have status code tests
- [ ] All API responses have structure validation
- [ ] HTML pages have element presence checks
- [ ] Security headers are verified
- [ ] Performance thresholds are defined and checked
- [ ] Tests are automated and reproducible
- [ ] Test results are logged for CI/CD integration
- [ ] Error cases are tested, not just success cases
- [ ] Test scripts are version controlled with the codebase
- [ ] Tests run in the same environment as production (Alpine Linux)

## Limitations and When to Install a Browser

Headless testing cannot verify:
- Visual layout and rendering
- CSS styling accuracy
- JavaScript runtime behavior in a real browser
- Accessibility tree structure
- Client-side performance metrics (LCP, CLS, INP)
- Cross-browser compatibility

**When you must install a browser:**
- Visual regression testing is required
- Testing complex SPAs with heavy client-side logic
- Accessibility compliance verification
- Performance profiling with real user metrics
- Cross-browser compatibility testing

**Minimal Browser Installation for Alpine (if absolutely necessary):**

```bash
# Install Chromium (lightweight compared to full Chrome)
apk add chromium

# Run headless
chromium --headless --disable-gpu --dump-dom https://example.com

# Take screenshot (requires additional setup)
chromium --headless --disable-gpu --screenshot=/tmp/screenshot.png https://example.com
```

Use headless testing as your first approach, and only install a browser when the specific limitations above block your testing goals.
