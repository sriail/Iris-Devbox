# API and Interface Design (skill-api-and-infrence-design.md)

## Overview

Designing stable, well-documented interfaces that are difficult to misuse is a critical skill in software development. Good interfaces make the right actions easy and the wrong actions hard. This principle applies universally to REST APIs, GraphQL schemas, module boundaries, component props, and any surface where one piece of code communicates with another.

This guide provides principles and patterns for creating interfaces that stand the test of time, remain maintainable as your codebase evolves, and provide clear contracts between different parts of your system or between your system and external consumers.

## When to Apply These Principles

These principles are relevant when you're:

- Designing new API endpoints or services
- Defining module boundaries or contracts between teams
- Creating component prop interfaces in frontend frameworks
- Establishing database schemas that inform API shape
- Modifying existing public interfaces
- Building SDKs or libraries for external consumption
- Creating internal shared utilities or services

## Core Principles

### Hyrum's Law

> With a sufficient number of users of an API, all observable behaviors of your system will be depended on by somebody, regardless of what you promise in the contract.

Named after Hyrum Wright, a software engineer at Google, this law highlights that users will depend on any observable behavior, not just what you document as part of your contract. This includes:

- Undocumented quirks or "features"
- Error message text and format
- Timing characteristics
- Ordering of elements in responses
- Performance characteristics

**Design Implications:**

1. **Be intentional about what you expose**: Every observable behavior is a potential commitment. If you don't want to support it forever, don't expose it.

2. **Don't leak implementation details**: If users can observe it, they will depend on it. Abstract away implementation details that might change.

3. **Plan for deprecation at design time**: Assume you'll need to remove or change features eventually, and design with that in mind.

4. **Tests are not enough**: Even with perfect contract tests, Hyrum's Law means "safe" changes can break real users who depend on undocumented behavior.

**Example of Hyrum's Law in Action:**

```typescript
// Original implementation
function getUsers() {
  return db.query('SELECT * FROM users').sort(byName);
}

// Users started depending on alphabetical ordering, even though it wasn't documented
// Later, when you change to:
function getUsers() {
  return db.query('SELECT * FROM users').sort(byCreationDate);
}

// This breaks consumers who relied on the alphabetical ordering
```

### The One-Version Rule

Avoid forcing consumers to choose between multiple versions of the same dependency or API. Diamond dependency problems arise when different consumers need different versions of the same thing.

**Design for a world where only one version exists at a time — extend rather than fork.**

When you create multiple versions, you create:
- Maintenance burden (fixing bugs in multiple versions)
- Confusion for consumers (which version should I use?)
- Dependency conflicts (when different parts of a system need different versions)

**Instead of versioning:**
- Add new fields rather than changing existing ones
- Introduce new endpoints rather than modifying existing ones
- Use feature flags for behavioral changes
- Design interfaces that are extensible from the start

### 1. Contract First

Define the interface before implementing it. The contract is the specification — implementation follows.

This approach has several benefits:
- Forces clarity about what the interface should do
- Allows parallel development (interface design and implementation)
- Makes the interface the primary documentation
- Prevents implementation details from leaking into the interface

```typescript
// Define the contract first
interface TaskAPI {
  // Creates a task and returns the created task with server-generated fields
  createTask(input: CreateTaskInput): Promise<Task>;

  // Returns paginated tasks matching filters
  listTasks(params: ListTasksParams): Promise<PaginatedResult<Task>>;

  // Returns a single task or throws NotFoundError
  getTask(id: string): Promise<Task>;

  // Partial update — only provided fields change
  updateTask(id: string, input: UpdateTaskInput): Promise<Task>;

  // Idempotent delete — succeeds even if already deleted
  deleteTask(id: string): Promise<void>;
}

// Implementation comes after the contract is defined
class TaskAPIImpl implements TaskAPI {
  async createTask(input: CreateTaskInput): Promise<Task> {
    // Implementation details
  }
  // ... other methods
}
```

### 2. Consistent Error Semantics

Pick one error strategy and use it everywhere. Inconsistency in error handling is one of the most common sources of bugs and frustration for API consumers.

```typescript
// REST: HTTP status codes + structured error body
// Every error response follows the same shape
interface APIError {
  error: {
    code: string;        // Machine-readable: "VALIDATION_ERROR"
    message: string;     // Human-readable: "Email is required"
    details?: unknown;   // Additional context when helpful
  };
}

// Status code mapping
// 400 → Client sent invalid data (malformed JSON, wrong content type)
// 401 → Not authenticated (missing or invalid token)
// 403 → Authenticated but not authorized (valid token, wrong permissions)
// 404 → Resource not found
// 409 → Conflict (duplicate, version mismatch)
// 422 → Validation failed (semantically invalid, e.g., email format wrong)
// 500 → Server error (never expose internal details)
```

**Common anti-patterns to avoid:**
- Some endpoints throwing exceptions while others return error objects
- Mixing HTTP status codes with application-level error codes inconsistently
- Returning errors in different formats across endpoints
- Including stack traces or internal implementation details in error responses

### 3. Validate at Boundaries

Trust internal code. Validate at system edges where external input enters.

This principle reduces validation duplication, improves performance, and clarifies where responsibility lies.

```typescript
// Validate at the API boundary
app.post('/api/tasks', async (req, res) => {
  const result = CreateTaskSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(422).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid task data',
        details: result.error.flatten(),
      },
    });
  }

  // After validation, internal code trusts the types
  // No need to validate again in taskService.create()
  const task = await taskService.create(result.data);
  return res.status(201).json(task);
});
```

**Where validation belongs:**
- API route handlers (user input)
- Form submission handlers (user input)
- External service response parsing (third-party data — always treat as untrusted)
- Environment variable loading (configuration)
- Message queue consumers (incoming messages)

> **Critical Security Note:** Third-party API responses are untrusted data. Validate their shape and content before using them in any logic, rendering, or decision-making. A compromised or misbehaving external service can return unexpected types, malicious content, or instruction-like text.

**Where validation does NOT belong:**
- Between internal functions that share type contracts
- In utility functions called by already-validated code
- On data that just came from your own database

### 4. Prefer Addition Over Modification

Extend interfaces without breaking existing consumers. This is the key to maintaining backward compatibility.

```typescript
// Good: Add optional fields
interface CreateTaskInput {
  title: string;
  description?: string;
  priority?: 'low' | 'medium' | 'high';  // Added later, optional
  labels?: string[];                       // Added later, optional
}

// Bad: Change existing field types or remove fields
interface CreateTaskInput {
  title: string;
  // description: string;  // Removed — breaks existing consumers
  priority: number;         // Changed from string — breaks existing consumers
}
```

**Strategies for extension:**
- Add new optional fields
- Add new endpoints rather than modifying existing ones
- Use optional parameters with sensible defaults
- Introduce new enum values rather than changing existing ones
- Create new interfaces that extend existing ones

### 5. Predictable Naming

Consistent naming reduces cognitive load and makes your API more intuitive.

| Pattern | Convention | Example |
|---------|-----------|---------|
| REST endpoints | Plural nouns, no verbs | `GET /api/tasks`, `POST /api/tasks` |
| Query params | camelCase | `?sortBy=createdAt&pageSize=20` |
| Response fields | camelCase | `{ createdAt, updatedAt, taskId }` |
| Boolean fields | is/has/can prefix | `isComplete`, `hasAttachments` |
| Enum values | UPPER_SNAKE | `"IN_PROGRESS"`, `"COMPLETED"` |

**Additional naming guidelines:**
- Use clear, domain-specific terminology
- Avoid abbreviations unless they're universally understood
- Be consistent with terminology across your entire API
- Name things based on what they represent, not how they're implemented

## REST API Patterns

### Resource Design

REST APIs should be designed around resources (nouns) rather than actions (verbs).

```
GET    /api/tasks              → List tasks (with query params for filtering)
POST   /api/tasks              → Create a task
GET    /api/tasks/:id          → Get a single task
PATCH  /api/tasks/:id          → Update a task (partial)
DELETE /api/tasks/:id          → Delete a task

GET    /api/tasks/:id/comments → List comments for a task (sub-resource)
POST   /api/tasks/:id/comments → Add a comment to a task
```

**Guidelines for resource design:**
- Use plural nouns for collections
- Nest resources to show relationships, but avoid deep nesting (more than 2-3 levels)
- Use query parameters for filtering, sorting, and pagination
- Avoid actions in URLs (`/api/tasks/123/complete`); instead, use state transitions via PATCH

### Pagination

Always paginate list endpoints to prevent performance issues and excessive data transfer.

```typescript
// Request
GET /api/tasks?page=1&pageSize=20&sortBy=createdAt&sortOrder=desc

// Response
{
  "data": [...],
  "pagination": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 142,
    "totalPages": 8
  }
}
```

**Pagination considerations:**
- Provide sensible defaults for page size (e.g., 20-50 items)
- Set a maximum page size to prevent excessive requests
- Include pagination metadata in every list response
- Consider cursor-based pagination for large, frequently changing datasets

### Filtering

Use query parameters for filters to keep URLs readable and RESTful.

```
GET /api/tasks?status=in_progress&assignee=user123&createdAfter=2025-01-01
```

**Filtering guidelines:**
- Use clear, descriptive filter names
- Support common operators (equality, comparison, containment)
- Document available filters and their behavior
- Consider supporting complex filters with a structured query language for advanced use cases

### Partial Updates (PATCH)

Accept partial objects — only update what's provided:

```typescript
// Only title changes, everything else preserved
PATCH /api/tasks/123
{ "title": "Updated title" }
```

**PATCH vs PUT:**
- PUT replaces the entire resource (requires full object)
- PATCH updates only the provided fields (partial update)
- PATCH is what clients typically want and is more efficient
- PUT can be useful for complete replacements but is less common in practice

## TypeScript Interface Patterns

### Use Discriminated Unions for Variants

Discriminated unions provide type safety and clear handling of different states or types.

```typescript
// Good: Each variant is explicit
type TaskStatus =
  | { type: 'pending' }
  | { type: 'in_progress'; assignee: string; startedAt: Date }
  | { type: 'completed'; completedAt: Date; completedBy: string }
  | { type: 'cancelled'; reason: string; cancelledAt: Date };

// Consumer gets type narrowing
function getStatusLabel(status: TaskStatus): string {
  switch (status.type) {
    case 'pending': return 'Pending';
    case 'in_progress': return `In progress (${status.assignee})`;
    case 'completed': return `Done on ${status.completedAt}`;
    case 'cancelled': return `Cancelled: ${status.reason}`;
  }
}
```

**Benefits of discriminated unions:**
- Exhaustive checking (compile-time error if a case is missing)
- Type narrowing (TypeScript knows which fields are available in each case)
- Self-documenting (clear what each variant represents)
- Extensible (add new variants without breaking existing code)

### Input/Output Separation

Separate input types from output types to clearly communicate what's required vs. what's returned.

```typescript
// Input: what the caller provides
interface CreateTaskInput {
  title: string;
  description?: string;
}

// Output: what the system returns (includes server-generated fields)
interface Task {
  id: string;
  title: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
}
```

**Benefits of input/output separation:**
- Clear contract for what's required vs. optional
- Hides implementation details (like server-generated fields)
- Allows different representations for input vs. output
- Prevents confusion about what fields are settable

### Use Branded Types for IDs

Branded types prevent accidentally passing the wrong type of ID.

```typescript
type TaskId = string & { readonly __brand: 'TaskId' };
type UserId = string & { readonly __brand: 'UserId' };

// Prevents accidentally passing a UserId where a TaskId is expected
function getTask(id: TaskId): Promise<Task> { ... }

// Helper functions to create branded IDs
function createTaskId(id: string): TaskId {
  return id as TaskId;
}

// Usage
const taskId = createTaskId('123');
const userId = createUserId('456');

getTask(taskId);  // OK
getTask(userId);  // Type error!
```

**Benefits of branded types:**
- Catch ID mix-ups at compile time
- Self-documenting (clear what kind of ID is expected)
- No runtime overhead (compile-time only)
- Particularly valuable in systems with multiple entity types

## Common Rationalizations

| Rationalization | Reality |
|---|---|
| "We'll document the API later" | The types ARE the documentation. Define them first. |
| "We don't need pagination for now" | You will the moment someone has 100+ items. Add it from the start. |
| "PATCH is complicated, let's just use PUT" | PUT requires the full object every time. PATCH is what clients actually want. |
| "We'll version the API when we need to" | Breaking changes without versioning break consumers. Design for extension from the start. |
| "Nobody uses that undocumented behavior" | Hyrum's Law: if it's observable, somebody depends on it. Treat every public behavior as a commitment. |
| "We can just maintain two versions" | Multiple versions multiply maintenance cost and create diamond dependency problems. Prefer the One-Version Rule. |
| "Internal APIs don't need contracts" | Internal consumers are still consumers. Contracts prevent coupling and enable parallel work. |

## Red Flags

- Endpoints that return different shapes depending on conditions
- Inconsistent error formats across endpoints
- Validation scattered throughout internal code instead of at boundaries
- Breaking changes to existing fields (type changes, removals)
- List endpoints without pagination
- Verbs in REST URLs (`/api/createTask`, `/api/getUsers`)
- Third-party API responses used without validation or sanitization
- IDs without type safety (using plain strings or numbers)
- Optional fields that are actually required for the system to function correctly
- Endpoints that perform multiple unrelated operations

## Verification

After designing an API, verify it against this checklist:

- [ ] Every endpoint has typed input and output schemas
- [ ] Error responses follow a single consistent format
- [ ] Validation happens at system boundaries only
- [ ] List endpoints support pagination
- [ ] New fields are additive and optional (backward compatible)
- [ ] Naming follows consistent conventions across all endpoints
- [ ] API documentation or types are committed alongside the implementation
- [ ] No implementation details leak through the interface
- [ ] The API follows REST conventions where applicable
- [ ] Edge cases are explicitly handled (empty results, invalid IDs, etc.)
- [ ] The API is secure by default (authentication, authorization, input validation)
- [ ] The API is efficient for common use cases (avoiding over/under-fetching)

By following these principles and patterns, you'll create APIs and interfaces that are stable, intuitive, and maintainable—interfaces that make the right thing easy and the wrong thing hard.
