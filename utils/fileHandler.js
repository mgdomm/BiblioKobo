const fs = require('fs').promises;
const path = require('path');

/**
 * Maneja la lectura y escritura de archivos JSON
 */
class FileHandler {
  /**
   * Lee un archivo JSON
   * @param {string} filePath - Ruta del archivo
   * @returns {Promise<any>} - Contenido del archivo parseado
   */
  static async readJSON(filePath) {
    try {
      const absolutePath = path.resolve(filePath);
      const data = await fs.readFile(absolutePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        // Si el archivo no existe, retorna un array vacío
        return [];
      }
      throw error;
    }
  }

  /**
   * Escribe datos en un archivo JSON
   * @param {string} filePath - Ruta del archivo
   * @param {any} data - Datos a escribir
   */
  static async writeJSON(filePath, data) {
    try {
      const absolutePath = path.resolve(filePath);
      await fs.writeFile(absolutePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      throw error;
    }
  }

  /**
   * Añade un elemento a un archivo JSON (array)
   * @param {string} filePath - Ruta del archivo
   * @param {any} item - Elemento a añadir
   */
  static async addToJSON(filePath, item) {
    try {
      const data = await this.readJSON(filePath);
      data.push(item);
      await this.writeJSON(filePath, data);
      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Actualiza un elemento en un archivo JSON
   * @param {string} filePath - Ruta del archivo
   * @param {function} predicate - Función para encontrar el elemento
   * @param {object} updates - Actualizaciones a aplicar
   */
  static async updateInJSON(filePath, predicate, updates) {
    try {
      const data = await this.readJSON(filePath);
      const index = data.findIndex(predicate);
      
      if (index !== -1) {
        data[index] = { ...data[index], ...updates };
        await this.writeJSON(filePath, data);
        return data[index];
      }
      
      return null;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Elimina un elemento de un archivo JSON
   * @param {string} filePath - Ruta del archivo
   * @param {function} predicate - Función para encontrar el elemento
   */
  static async removeFromJSON(filePath, predicate) {
    try {
      const data = await this.readJSON(filePath);
      const filteredData = data.filter(item => !predicate(item));
      await this.writeJSON(filePath, filteredData);
      return filteredData;
    } catch (error) {
      throw error;
    }
  }
}

module.exports = FileHandler;
