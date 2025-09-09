const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Agent Wallboard API - Enhanced Phase 1',
      version: '1.0.0',
      description: 'Professional Node.js API สำหรับจัดการ Call Center Agents แบบ Real-time',
    },
    servers: [
      {
        url: 'http://localhost:3001/api',
      },
    ],
  },
  apis: ['./routes/*.js'], // กำหนดให้ scan comment ในไฟล์ route ทุกไฟล์ใน folder routes
};

const swaggerSpec = swaggerJsdoc(options);

function setupSwagger(app) {
  app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

module.exports = setupSwagger;//  คอมเมนต์
