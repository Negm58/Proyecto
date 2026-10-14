/**
 * Middleware de validación de campos requeridos
 *
 * @param {string[]} fields - Campos requeridos en el body
 */
const validateRequired = (fields) => {
  return (req, res, next) => {
    const missing = fields.filter((field) => {
      const value = req.body[field];
      return value === undefined || value === null || value === '';
    });

    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Campos requeridos faltantes: ${missing.join(', ')}`,
      });
    }

    next();
  };
};

/**
 * Middleware de validación de email
 */
const validateEmail = (req, res, next) => {
  const { email } = req.body;
  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'El formato del email no es válido.',
      });
    }
  }
  next();
};

/**
 * Middleware de validación numérica positiva
 *
 * @param {string[]} fields - Campos que deben ser numéricos positivos
 */
const validatePositiveNumbers = (fields) => {
  return (req, res, next) => {
    const errors = [];
    fields.forEach((field) => {
      const value = req.body[field];
      if (value !== undefined && value !== null) {
        const num = Number(value);
        if (isNaN(num) || num < 0) {
          errors.push(`${field} debe ser un número positivo`);
        }
      }
    });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Errores de validación.',
        errors,
      });
    }

    next();
  };
};

module.exports = { validateRequired, validateEmail, validatePositiveNumbers };
