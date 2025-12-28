'use client'

import dynamic from 'next/dynamic'
import 'swagger-ui-react/swagger-ui.css'

const SwaggerUI = dynamic(() => import('swagger-ui-react'), { ssr: false })

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-white">
      <style jsx global>{`
        /* Custom Swagger UI Styling */
        .swagger-ui .topbar {
          display: none;
        }
        
        .swagger-ui .info {
          margin: 20px 0;
        }
        
        .swagger-ui .info .title {
          font-size: 2.5rem;
          font-weight: 700;
        }
        
        .swagger-ui .info .description {
          font-size: 1rem;
          line-height: 1.6;
        }
        
        .swagger-ui .opblock-tag {
          font-size: 1.25rem;
          font-weight: 600;
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 0;
        }
        
        .swagger-ui .opblock {
          border-radius: 8px;
          margin-bottom: 8px;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        }
        
        .swagger-ui .opblock .opblock-summary {
          border-radius: 8px;
        }
        
        .swagger-ui .opblock.opblock-get {
          border-color: #61affe;
          background: rgba(97, 175, 254, 0.05);
        }
        
        .swagger-ui .opblock.opblock-post {
          border-color: #49cc90;
          background: rgba(73, 204, 144, 0.05);
        }
        
        .swagger-ui .opblock.opblock-put {
          border-color: #fca130;
          background: rgba(252, 161, 48, 0.05);
        }
        
        .swagger-ui .opblock.opblock-delete {
          border-color: #f93e3e;
          background: rgba(249, 62, 62, 0.05);
        }
        
        .swagger-ui .btn {
          border-radius: 6px;
        }
        
        .swagger-ui .btn.execute {
          background-color: #4f46e5;
          border-color: #4f46e5;
        }
        
        .swagger-ui .btn.execute:hover {
          background-color: #4338ca;
        }
        
        .swagger-ui section.models {
          border-radius: 8px;
        }
        
        .swagger-ui .model-box {
          border-radius: 8px;
        }
        
        /* Header */
        .api-docs-header {
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          padding: 2rem;
          color: white;
        }
        
        .api-docs-header h1 {
          font-size: 2rem;
          font-weight: 700;
          margin-bottom: 0.5rem;
        }
        
        .api-docs-header p {
          opacity: 0.9;
        }
        
        .api-docs-nav {
          display: flex;
          gap: 1rem;
          margin-top: 1rem;
        }
        
        .api-docs-nav a {
          padding: 0.5rem 1rem;
          background: rgba(255, 255, 255, 0.2);
          border-radius: 6px;
          text-decoration: none;
          color: white;
          font-size: 0.875rem;
          transition: background 0.2s;
        }
        
        .api-docs-nav a:hover {
          background: rgba(255, 255, 255, 0.3);
        }
      `}</style>
      
      <div className="api-docs-header">
        <h1>PriCal API Documentation</h1>
        <p>Webhook-based access control for Calendly</p>
        <div className="api-docs-nav">
          <a href="/">← Back to App</a>
          <a href="/api/docs" target="_blank">OpenAPI JSON</a>
          <a href="https://github.com/yourusername/prical" target="_blank">GitHub</a>
        </div>
      </div>
      
      <SwaggerUI 
        url="/api/docs" 
        docExpansion="list"
        defaultModelsExpandDepth={1}
        displayRequestDuration={true}
        filter={true}
        showExtensions={true}
        showCommonExtensions={true}
        tryItOutEnabled={true}
      />
    </div>
  )
}

