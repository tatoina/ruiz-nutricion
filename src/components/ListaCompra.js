import React, { useState, useEffect } from "react";
import { db } from "../Firebase";
import { collection, getDocs } from "firebase/firestore";

/**
 * Componente que muestra la lista de compra de un usuario
 * basándose en los platos de su menú semanal
 */
const ListaCompra = React.memo(function ListaCompra({ menu, tipoMenu }) {
  const [listaCompra, setListaCompra] = useState({});
  const [loading, setLoading] = useState(false);
  const [seccionesColapsadas, setSeccionesColapsadas] = useState({
    lacteos: true,
    carnes: true,
    pescados: true,
    frutas: true,
    verduras: true,
    legumbres: true,
    cereales: true,
    frutos_secos: true,
    huevos: true,
    aceites: true,
    otros: true
  });
  const [productosComprados, setProductosComprados] = useState({});

  useEffect(() => {
    generarListaCompra();
  }, [menu, tipoMenu]);

  const generarListaCompra = async () => {
    setLoading(true);
    try {
      // Extraer todos los platos del menú
      const platosSet = new Set();
      const categorias = ["desayuno", "almuerzo", "comida", "merienda", "cena"];
      
      // Si es menú tabla (array de 7 días)
      if (Array.isArray(menu)) {
        menu.forEach(dia => {
          if (dia && typeof dia === 'object') {
            categorias.forEach(cat => {
              if (dia[cat]) {
                // Separar por líneas y limpiar
                const platos = dia[cat].split('\n')
                  .map(line => line.replace(/^[•\-*]\s*/, '').trim())
                  .filter(line => line && line.length > 0);
                platos.forEach(plato => platosSet.add(plato));
              }
            });
          }
        });
      }
      // Si es menú vertical (objeto con arrays)
      else if (typeof menu === 'object' && menu) {
        categorias.forEach(cat => {
          if (menu[cat] && Array.isArray(menu[cat])) {
            menu[cat].forEach(plato => {
              if (plato && plato.trim()) {
                platosSet.add(plato.trim());
              }
            });
          }
        });
      }

      // Convertir a array y ordenar alfabéticamente
      const platosArray = Array.from(platosSet).sort((a, b) => a.localeCompare(b));
      
      // Agrupar por categoría
      const listaAgrupada = await agruparPorCategoria(platosArray);
      setListaCompra(listaAgrupada);
      
    } catch (err) {
      console.error("Error generando lista de compra:", err);
    } finally {
      setLoading(false);
    }
  };

  // Función para normalizar texto (eliminar acentos, convertir a minúsculas, quitar plurales)
  const normalizarTexto = (texto) => {
    return texto
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // Eliminar acentos
      .replace(/s$/, ''); // Quitar 's' final (plurales simples)
  };

  const agruparPorCategoria = async (platos) => {
    const resultado = {
      lacteos: new Set(),
      carnes: new Set(),
      pescados: new Set(),
      frutas: new Set(),
      verduras: new Set(),
      legumbres: new Set(),
      cereales: new Set(),
      frutos_secos: new Set(),
      huevos: new Set(),
      aceites: new Set(),
      otros: new Set()
    };

    // Palabras clave para clasificar productos con sus nombres normalizados
    // Ahora incluimos sinónimos y variaciones
    const clasificacion = {
      lacteos: [
        { palabras: ['leche'], nombre: 'Leche' },
        { palabras: ['yogur'], nombre: 'Yogur' },
        { palabras: ['queso'], nombre: 'Queso' },
        { palabras: ['kefir'], nombre: 'Kéfir' },
        { palabras: ['nata'], nombre: 'Nata' },
        { palabras: ['mantequilla'], nombre: 'Mantequilla' },
        { palabras: ['requeson'], nombre: 'Requesón' },
        { palabras: ['cuajada'], nombre: 'Cuajada' }
      ],
      carnes: [
        { palabras: ['pollo'], nombre: 'Pollo' },
        { palabras: ['pavo'], nombre: 'Pavo' },
        { palabras: ['ternera'], nombre: 'Ternera' },
        { palabras: ['cerdo'], nombre: 'Cerdo' },
        { palabras: ['cordero'], nombre: 'Cordero' },
        { palabras: ['pechuga'], nombre: 'Pechuga de pollo' },
        { palabras: ['lomo'], nombre: 'Lomo' },
        { palabras: ['jamon'], nombre: 'Jamón' },
        { palabras: ['fiambre'], nombre: 'Fiambre' },
        { palabras: ['salchicha'], nombre: 'Salchicha' }
      ],
      pescados: [
        { palabras: ['salmon'], nombre: 'Salmón' },
        { palabras: ['atun'], nombre: 'Atún' },
        { palabras: ['merluza'], nombre: 'Merluza' },
        { palabras: ['bacalao'], nombre: 'Bacalao' },
        { palabras: ['pescado'], nombre: 'Pescado' },
        { palabras: ['marisco'], nombre: 'Marisco' },
        { palabras: ['gamba'], nombre: 'Gambas' },
        { palabras: ['langostino'], nombre: 'Langostinos' },
        { palabras: ['mejillon'], nombre: 'Mejillones' },
        { palabras: ['calamar'], nombre: 'Calamar' },
        { palabras: ['pulpo'], nombre: 'Pulpo' }
      ],
      frutas: [
        { palabras: ['manzana'], nombre: 'Manzanas' },
        { palabras: ['platano', 'banana'], nombre: 'Plátanos' },
        { palabras: ['naranja'], nombre: 'Naranjas' },
        { palabras: ['pera'], nombre: 'Peras' },
        { palabras: ['fresa'], nombre: 'Fresas' },
        { palabras: ['kiwi'], nombre: 'Kiwis' },
        { palabras: ['uva'], nombre: 'Uvas' },
        { palabras: ['melon'], nombre: 'Melón' },
        { palabras: ['sandia'], nombre: 'Sandía' },
        { palabras: ['pina'], nombre: 'Piña' },
        { palabras: ['melocoton'], nombre: 'Melocotones' },
        { palabras: ['albaricoque'], nombre: 'Albaricoques' },
        { palabras: ['ciruela'], nombre: 'Ciruelas' },
        { palabras: ['cereza'], nombre: 'Cerezas' },
        { palabras: ['frambuesa'], nombre: 'Frambuesas' },
        { palabras: ['arandano'], nombre: 'Arándanos' },
        { palabras: ['mandarina'], nombre: 'Mandarinas' },
        { palabras: ['limon'], nombre: 'Limones' },
        { palabras: ['pomelo'], nombre: 'Pomelos' }
      ],
      verduras: [
        { palabras: ['lechuga'], nombre: 'Lechuga' },
        { palabras: ['tomate'], nombre: 'Tomates' },
        { palabras: ['pepino'], nombre: 'Pepino' },
        { palabras: ['zanahoria'], nombre: 'Zanahorias' },
        { palabras: ['brocoli'], nombre: 'Brócoli' },
        { palabras: ['espinaca'], nombre: 'Espinacas' },
        { palabras: ['acelga'], nombre: 'Acelgas' },
        { palabras: ['calabacin'], nombre: 'Calabacín' },
        { palabras: ['berenjena'], nombre: 'Berenjenas' },
        { palabras: ['pimiento'], nombre: 'Pimientos' },
        { palabras: ['cebolla'], nombre: 'Cebollas' },
        { palabras: ['ajo'], nombre: 'Ajos' },
        { palabras: ['coliflor'], nombre: 'Coliflor' },
        { palabras: ['col'], nombre: 'Col' },
        { palabras: ['esparrago'], nombre: 'Espárragos' },
        { palabras: ['apio'], nombre: 'Apio' },
        { palabras: ['remolacha'], nombre: 'Remolacha' },
        { palabras: ['rabano'], nombre: 'Rábanos' },
        { palabras: ['puerro'], nombre: 'Puerros' },
        { palabras: ['judia verde'], nombre: 'Judías verdes' },
        { palabras: ['guisante'], nombre: 'Guisantes' },
        { palabras: ['alcachofa'], nombre: 'Alcachofas' },
        { palabras: ['champinon', 'seta'], nombre: 'Champiñones/Setas' },
        { palabras: ['cogollo'], nombre: 'Cogollos' }
      ],
      legumbres: [
        { palabras: ['lenteja'], nombre: 'Lentejas' },
        { palabras: ['garbanzo'], nombre: 'Garbanzos' },
        { palabras: ['alubia'], nombre: 'Alubias' },
        { palabras: ['judia'], nombre: 'Judías' },
        { palabras: ['soja'], nombre: 'Soja' }
      ],
      cereales: [
        { palabras: ['arroz'], nombre: 'Arroz' },
        { palabras: ['pasta'], nombre: 'Pasta' },
        { palabras: ['pan', 'tosta', 'tostada'], nombre: 'Pan/Tostadas' },
        { palabras: ['avena'], nombre: 'Avena' },
        { palabras: ['quinoa'], nombre: 'Quinoa' },
        { palabras: ['trigo'], nombre: 'Trigo' },
        { palabras: ['centeno'], nombre: 'Centeno' },
        { palabras: ['cebada'], nombre: 'Cebada' },
        { palabras: ['maiz'], nombre: 'Maíz' },
        { palabras: ['cereal'], nombre: 'Cereales' },
        { palabras: ['tortita'], nombre: 'Tortitas' },
        { palabras: ['integral'], nombre: 'Pan integral' }
      ],
      frutos_secos: [
        { palabras: ['almendra'], nombre: 'Almendras' },
        { palabras: ['nuez', 'nuece'], nombre: 'Nueces' },
        { palabras: ['avellana'], nombre: 'Avellanas' },
        { palabras: ['pistacho'], nombre: 'Pistachos' },
        { palabras: ['anacardo'], nombre: 'Anacardos' },
        { palabras: ['cacahuete'], nombre: 'Cacahuetes' },
        { palabras: ['castana'], nombre: 'Castañas' },
        { palabras: ['pinon'], nombre: 'Piñones' }
      ],
      huevos: [
        { palabras: ['huevo'], nombre: 'Huevos' },
        { palabras: ['clara'], nombre: 'Claras de huevo' },
        { palabras: ['yema'], nombre: 'Yemas de huevo' },
        { palabras: ['tortilla'], nombre: 'Huevos (tortilla)' }
      ],
      aceites: [
        { palabras: ['aceite'], nombre: 'Aceite' },
        { palabras: ['oliva'], nombre: 'Aceite de oliva' },
        { palabras: ['girasol'], nombre: 'Aceite de girasol' },
        { palabras: ['vinagre'], nombre: 'Vinagre' },
        { palabras: ['salsa'], nombre: 'Salsa' },
        { palabras: ['especia'], nombre: 'Especias' }
      ]
    };

    // Procesar cada plato
    platos.forEach(plato => {
      const platoNormalizado = normalizarTexto(plato);
      let encontrado = false;
      
      // Buscar en cada categoría
      Object.entries(clasificacion).forEach(([categoria, items]) => {
        items.forEach(item => {
          // Verificar si alguna de las palabras clave está en el plato (normalizadas)
          const match = item.palabras.some(palabra => {
            const palabraNormalizada = normalizarTexto(palabra);
            return platoNormalizado.includes(palabraNormalizada);
          });
          
          if (match && !encontrado) {
            resultado[categoria].add(item.nombre);
            encontrado = true;
          }
        });
      });
      
      // Si no se clasificó, añadir a "otros"
      if (!encontrado) {
        resultado.otros.add(plato);
      }
    });

    // Convertir Sets a arrays ordenados
    const resultadoFinal = {};
    Object.keys(resultado).forEach(categoria => {
      resultadoFinal[categoria] = Array.from(resultado[categoria]).sort((a, b) => 
        a.localeCompare(b, 'es', { sensitivity: 'base' })
      );
    });

    return resultadoFinal;
  };

  const imprimirLista = () => {
    window.print();
  };

  const desmarcarTodo = () => {
    setProductosComprados({});
  };

  const toggleProducto = (categoria, plato) => {
    const key = `${categoria}_${plato}`;
    setProductosComprados(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const exportarLista = () => {
    let texto = `LISTA DE LA COMPRA\n`;
    texto += `Generada el: ${new Date().toLocaleDateString('es-ES')}\n\n`;
    texto += "=".repeat(60) + "\n\n";

    const categoriaLabels = {
      lacteos: "🥛 LÁCTEOS",
      carnes: "🍖 CARNES",
      pescados: "🐟 PESCADOS Y MARISCOS",
      frutas: "🍎 FRUTAS",
      verduras: "🥬 VERDURAS Y HORTALIZAS",
      legumbres: "🫘 LEGUMBRES",
      cereales: "🌾 CEREALES Y PANES",
      frutos_secos: "🥜 FRUTOS SECOS",
      huevos: "🥚 HUEVOS",
      aceites: "🫒 ACEITES Y CONDIMENTOS",
      otros: "📝 OTROS"
    };

    Object.entries(listaCompra).forEach(([categoria, platos]) => {
      if (platos.length > 0) {
        texto += `${categoriaLabels[categoria] || categoria.toUpperCase()}\n`;
        texto += "-".repeat(60) + "\n";
        platos.forEach(plato => {
          texto += `  • ${plato}\n`;
        });
        texto += "\n";
      }
    });

    // Crear y descargar archivo
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Lista_Compra_${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const categoriaLabels = {
    lacteos: "🥛 Lácteos",
    carnes: "🍖 Carnes",
    pescados: "🐟 Pescados y Mariscos",
    frutas: "🍎 Frutas",
    verduras: "🥬 Verduras y Hortalizas",
    legumbres: "🫘 Legumbres",
    cereales: "🌾 Cereales y Panes",
    frutos_secos: "🥜 Frutos Secos",
    huevos: "🥚 Huevos",
    aceites: "🫒 Aceites y Condimentos",
    otros: "📝 Otros"
  };

  const categoriasConPlatos = Object.entries(listaCompra).filter(([_, platos]) => platos.length > 0);
  const totalPlatos = categoriasConPlatos.reduce((sum, [_, platos]) => sum + platos.length, 0);

  if (loading) {
    return (
      <div style={{
        padding: "40px",
        textAlign: "center",
        color: "#64748b"
      }}>
        <p style={{ fontSize: "16px", margin: 0 }}>⏳ Generando tu lista de compra...</p>
      </div>
    );
  }

  if (totalPlatos === 0) {
    return (
      <div style={{
        padding: "40px",
        textAlign: "center",
        background: "#fef3c7",
        borderRadius: "8px",
        border: "2px solid #fbbf24",
        margin: "20px"
      }}>
        <p style={{ fontSize: "16px", margin: 0, color: "#92400e" }}>
          ⚠️ No tienes menú asignado todavía
        </p>
      </div>
    );
  }

  return (
    <div className="lista-compra-container" style={{ padding: "20px" }}>
      <div style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: "20px",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div>
          <h2 style={{ 
            margin: "0 0 4px 0", 
            fontSize: "22px", 
            fontWeight: "700",
            color: "#15803d"
          }}>
            🛒 Mi Lista de la Compra
          </h2>
          <p style={{ margin: 0, color: "#64748b", fontSize: "14px" }}>
            {totalPlatos} alimento{totalPlatos !== 1 ? 's' : ''} en {categoriasConPlatos.length} categoría{categoriasConPlatos.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="no-print" style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={desmarcarTodo}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#64748b",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            ✓ Desmarcar todo
          </button>
          <button
            onClick={imprimirLista}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#3b82f6",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            🖨️ Imprimir
          </button>
          <button
            onClick={exportarLista}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "#16a34a",
              color: "white",
              fontWeight: "600",
              fontSize: "14px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            💾 Exportar
          </button>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        {Object.entries(listaCompra).map(([categoria, platos]) => {
          if (platos.length === 0) return null;
          
          const isCollapsed = seccionesColapsadas[categoria];
          
          return (
            <div key={categoria} style={{
              background: "#f8fafc",
              borderRadius: "8px",
              padding: "16px",
              border: "1px solid #e2e8f0"
            }}>
              <div 
                onClick={() => setSeccionesColapsadas(prev => ({ 
                  ...prev, 
                  [categoria]: !prev[categoria] 
                }))}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  cursor: "pointer",
                  marginBottom: isCollapsed ? "0" : "12px",
                  paddingBottom: isCollapsed ? "0" : "8px",
                  borderBottom: isCollapsed ? "none" : "2px solid #e2e8f0"
                }}
              >
                <h3 style={{
                  margin: "0",
                  fontSize: "17px",
                  fontWeight: "700",
                  color: "#1e293b"
                }}>
                  {categoriaLabels[categoria] || categoria}
                  <span style={{ 
                    marginLeft: "8px", 
                    fontSize: "14px", 
                    color: "#64748b",
                    fontWeight: "500"
                  }}>
                    ({platos.length})
                  </span>
                </h3>
                <span style={{
                  fontSize: "20px",
                  color: "#64748b",
                  transition: "transform 0.2s",
                  transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)"
                }}>
                  ▼
                </span>
              </div>
              {!isCollapsed && (
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  {platos.map((plato, idx) => {
                    const key = `${categoria}_${plato}`;
                    const isChecked = productosComprados[key];
                    
                    return (
                      <div
                        key={idx}
                        onClick={() => toggleProducto(categoria, plato)}
                        style={{
                          padding: "8px 12px",
                          background: "white",
                          borderRadius: "4px",
                          fontSize: "15px",
                          color: isChecked ? "#94a3b8" : "#334155",
                          border: "1px solid #e2e8f0",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          textDecoration: isChecked ? "line-through" : "none",
                          transition: "all 0.2s"
                        }}
                      >
                        <div style={{
                          width: "20px",
                          height: "20px",
                          border: `2px solid ${isChecked ? "#16a34a" : "#d1d5db"}`,
                          borderRadius: "4px",
                          background: isChecked ? "#16a34a" : "white",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          transition: "all 0.2s"
                        }}>
                          {isChecked && (
                            <span style={{ color: "white", fontSize: "14px", fontWeight: "bold" }}>✓</span>
                          )}
                        </div>
                        <span>{plato}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Estilos para impresión */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          
          .lista-compra-container {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
});

export default ListaCompra;
