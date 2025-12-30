# Oxylabs Scraper API - Quick Reference Guide

## Overview

Oxylabs provides enterprise-grade web scraping infrastructure with built-in proxy rotation, anti-bot protection, and AI-powered parsing. Two main products: **Web Scraper API** (general websites) and **Video Scraper API** (YouTube-specific).

---

## YouTube Video Scraper API

### **Available Data Sources**

| Source                       | Purpose             | Output                                 |
| ---------------------------- | ------------------- | -------------------------------------- |
| `youtube_transcript`         | Video transcripts   | Timestamped text segments              |
| `youtube_subtitles`          | Video subtitles     | Subtitle files                         |
| `youtube_metadata`           | Video details       | Title, views, likes, description, etc. |
| `youtube_search`             | Search results      | List of videos matching query          |
| `youtube_search_max`         | Deep search         | More comprehensive search results      |
| `youtube_channel`            | Channel information | Channel stats, videos, subscribers     |
| `youtube_video_trainability` | AI training rights  | Copyright/usage permissions            |

### **Transcript Features**

- **156 languages supported**
- Two types: `auto_generated` or `uploader_provided`
- Clean, structured JSON or TXT output
- Includes timestamps (start/end milliseconds)
- AI-ready formatting

### **Key Parameters**

- `query`: Video ID (not full URL)
- `language`: ISO language code (e.g., 'en', 'es', 'fr')
- `transcript_type`: Choose auto-generated or uploader-provided

### **Output Format**

Structured JSON with:

- Transcript segments
- Start/end timestamps
- Text content
- Status codes
- Job completion status

---

## Web Scraper API (General Purpose)

### **Core Capabilities**

#### **1. Universal Scraping**

- **Source types**: `universal`, `universal_ecommerce`
- Works on any website
- JavaScript rendering available
- Custom browser instructions (click, scroll, input text)

#### **2. Supported Categories**

- E-commerce websites (product pages, search results)
- Entertainment sites (including YouTube via universal source)
- News and media sites
- Social media platforms
- Business directories
- Any public web content

#### **3. AI-Powered Features**

**Custom Parser**:

- Define extraction rules using XPath or CSS selectors
- Self-healing parsers adapt to site changes automatically
- Create reusable parsing templates
- Extract specific data points (prices, titles, reviews, etc.)

**Browser Instructions**:

- Automate interactions: click buttons, fill forms, scroll
- Handle dynamic content loading
- Navigate multi-step processes
- Bypass cookie notices

### **4. Rendering Options**

- **Static HTML**: Fast, for simple pages
- **JavaScript rendering**: For dynamic content (React, Vue, Angular apps)
- **Custom wait times**: Ensure content loads fully

---

## Technical Infrastructure

### **Proxy & Anti-Bot Protection**

- **195+ country proxy pool**
- ML-driven proxy rotation and selection
- Automatic fingerprinting (HTTP headers, browser signatures)
- Built-in CAPTCHA solving
- Automatic retry logic
- IP rotation per request or session

### **Success Guarantees**

- **Pay only for successful results** (2xx status codes)
- Automatic retries on failures
- High success rates vs self-managed solutions

---

## Integration Options

### **Request Methods**

1. **Realtime API**: Synchronous requests, immediate responses
2. **Batch Processing**: Up to 5,000 URLs per batch request
3. **Scheduler**: Automate recurring scraping jobs
4. **Webhooks**: Async callbacks when jobs complete

### **Authentication**

- HTTP Basic Auth (username/password)
- Credentials provided on signup

### **Delivery Options**

- Direct HTTP response
- Cloud storage delivery (Amazon S3, Google Cloud Storage)
- Webhook callbacks

---

## Use Cases

### **YouTube Video Scraper**

✅ Transcript extraction for AI/ML training  
✅ Content analysis and research  
✅ Subtitle downloading for accessibility  
✅ Metadata collection for analytics  
✅ Channel performance tracking  
✅ Search trend analysis

### **Web Scraper API**

✅ Price monitoring (e-commerce)  
✅ Competitor analysis  
✅ Market research  
✅ Content aggregation  
✅ SEO monitoring  
✅ Lead generation  
✅ News monitoring  
✅ Social media tracking

---

## Key Advantages vs Self-Managed Solutions

| Feature          | Oxylabs                     | Self-Managed (yt-dlp + proxies) |
| ---------------- | --------------------------- | ------------------------------- |
| Proxy management | Automatic                   | Manual setup & rotation         |
| Anti-bot bypass  | Built-in AI                 | Custom implementation needed    |
| Maintenance      | Zero                        | Ongoing updates required        |
| Success rate     | High (paid only on success) | Variable, pay for all attempts  |
| Scalability      | Instant                     | Requires infrastructure         |
| CAPTCHA handling | Automatic                   | Manual solving or third-party   |
| Compliance       | ISO/SOC2 certified          | Your responsibility             |
| Support          | 24/7                        | Community forums                |

---

## Getting Started Workflow

1. **Sign up** for Oxylabs account
2. **Receive API credentials** (username/password)
3. **Choose data source** (youtube_transcript, universal, etc.)
4. **Make test requests** with sample data
5. **Implement error handling** for edge cases
6. **Monitor usage and costs** via dashboard
7. **Scale up** as needed

---

## Important Limitations & Considerations

### **Transcript-Specific**

- Not all videos have transcripts available
- Language must be specified correctly
- Some videos may only have auto-generated (lower quality)
- Private/restricted videos may not be accessible

---

**Summary**: Oxylabs provides production-ready scraping infrastructure that eliminates proxy management, anti-bot challenges, and maintenance overhead. For YouTube transcripts specifically, it offers structured, multi-language extraction with high reliability. The pay-for-success model reduces waste, and the API-first design makes integration straightforward across any technology stack.
