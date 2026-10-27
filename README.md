# URL Shortener API

A RESTful URL shortening service built with **Node.js, Express, and PostgreSQL**.

The API generates short links, manages stored URLs, redirects users to their original destinations, and tracks access counts.

## Features

- Generate random 6-character short codes
- Create, retrieve, update, and delete URLs
- Validate HTTP and HTTPS URLs
- Store URL records in PostgreSQL
- Track URL access counts
- Handle duplicate URLs and database errors

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| POST | `/shorten` | Create a shortened URL |
| GET | `/shorten/:shortcode` | Redirect to the original URL |
| PUT | `/shorten/:shortcode` | Update the original URL |
| DELETE | `/shorten/:shortcode` | Delete a shortened URL |
| GET | `/shorten/:shortcode/stats` | Retrieve URL statistics |

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Database:** PostgreSQL
- **Language:** JavaScript (ES Modules)

## Getting Started

1. Clone the repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up PostgreSQL and configure the database connection in `db.js`.
4. Start the application using the project's configured server entry point.

## Example Request

```bash
curl -X POST http://localhost:3000/shorten \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}'
```

## Project Background

Built as part of the [roadmap.sh URL Shortening Service](https://roadmap.sh/projects/url-shortening-service) project to practise REST API design, database integration, asynchronous operations, and error handling.

## Status

Core functionality implemented. Further improvements may include automated testing, authentication, and short-code collision retries.
