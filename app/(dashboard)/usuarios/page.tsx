"use client";

import Swal from "sweetalert2";
import { useRef } from "react";
import { Usuario } from "@prisma/client";
import ModalUsuario from "@/components/ModalUsuario";
import LoadingSpinner from "@/components/LoadingSpinner";
import SignatureCanvas from "react-signature-canvas";
import { useEffect, useState, useCallback } from "react";
import PaginationButtons from "@/components/PaginationButtons";
import { Trash2, Users, Edit3, Plus, RefreshCw } from "lucide-react";
import { TableHeader, TableCell } from "@/components/TableComponents";

interface ErrorDeValidacion {
  code: number;
  message?: string;
  results?: {
    campo: string;
    mensajes: string[];
  }[];
}

interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function UsuariosPage() {

  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [showEmptyMessage, setShowEmptyMessage] = useState(false);

  const [paginaActual, setPaginaActual] = useState(1);
  const [filtroNombre, setFiltroNombre] = useState("");
  const [filtroActual, setFiltroActual] = useState("");
  
  const firmaRef = useRef<SignatureCanvas | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [usuarioEditar, setUsuarioEditar] = useState<Usuario | null>(null);
  const [firmaTecnicoImg, setFirmaTecnicoImg] = useState<string | null>(null);
  const [meta, setMeta] = useState<PaginationMeta>({total: 0, page: 1, limit: 10, totalPages: 0});

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setFiltroActual(filtroNombre);
      setPaginaActual(1);
    }, 500);

    return () => clearTimeout(timer);
  }, [filtroNombre]);

  useEffect(() => {
    const canvas = firmaRef.current?.getCanvas();
    if (!canvas || !firmaRef.current) return;

    const ratio = window.devicePixelRatio || 1;

    canvas.width = 350 * ratio;
    canvas.height = 100 * ratio;
    canvas.style.width = "350px";
    canvas.style.height = "100px";

    const ctx = canvas.getContext("2d");
    if (ctx) ctx.scale(ratio, ratio);

    if (firmaTecnicoImg && usuarioEditar && modalOpen) {
      firmaRef.current.clear();
      firmaRef.current.fromDataURL(firmaTecnicoImg);
    } else {
      firmaRef.current.clear();
    }
  }, [firmaTecnicoImg, modalOpen, usuarioEditar]);

  // Función para formatear telefono
  const formatearTelefono = (valor: string) => {
    const soloNumeros = valor.replace(/\D/g, "");
    const limitado = soloNumeros.slice(0, 8);
    if (limitado.length > 4) {
      return limitado.slice(0, 4) + "-" + limitado.slice(4);
    }

    return limitado;
  };

  // Manejar input teléfono formateado
  const manejarCambioTelefono = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const valorFormateado = formatearTelefono(event.target.value);
    event.target.value = valorFormateado;
  };

  // Mostrar errores validación con SweetAlert
  function mostrarErroresValidacion(data: ErrorDeValidacion) {

    if (data.code !== 200 && data.code !== 201 && data.results && data.results.length > 0) {
      const erroresHtml = data.results.map((error) =>
        `<div class="mb-2"><ul class="ml-4 mt-1">${
          error.mensajes?.map((msg: string) => `<li>• ${msg}</li>`).join("") || '<li>Error inesperado!</li>'
          }</ul></div>`
      ).join("");

      Swal.fire({
        icon: "error",
        title: "Errores de validación",
        html: `<div class="text-left">${erroresHtml}</div>`,
        confirmButtonColor: "#295d0c",
        width: "500px",
      });

    } else if (data.code !== 200 && data.code !== 201) {

      Swal.fire({
        icon: "error",
        title: "Error",
        text: data.message || "Error inesperado",
        confirmButtonColor: "#295d0c",
      });

    }
  }

  async function cargarFirmaDelTecnico(usuarioId: number) {

    try {
      const res = await fetch(`/api/firmas/tecnico/${usuarioId}`);
      const data = await res.json();

      if (data.code === 200) {
        setFirmaTecnicoImg(data.results[0].firma_base64);
      } else {
        setFirmaTecnicoImg(null);
      }

    } catch (error) {
      setFirmaTecnicoImg(null);
    }

  }

  // Fetch usuarios desde API
  const fetchUsuarios = useCallback(async () => {
    setLoading(true);
    setShowEmptyMessage(false);

    try {
      const params = new URLSearchParams({
        page: paginaActual.toString(),
        limit: meta.limit.toString(),
        ...(filtroActual && { search: filtroActual })
      });

      const res = await fetch(`/api/usuarios?${params}`);
      const response = await res.json();

      if (response.code === 404) {
        setMeta({
          total: 0,
          page: paginaActual,
          limit: meta.limit,
          totalPages: 0
        });

        setUsuarios([]);
        setShowEmptyMessage(true);

        return;
      }

      if (!res.ok || response.code !== 200) {
        throw new Error(response.message || "Error al cargar usuarios");
      }

      setUsuarios(response.results ?? []);
      if (!response.results?.length) {
        setShowEmptyMessage(true);
      }

      if (response.meta) {
        setMeta(response.meta);
      }

    } catch (error) {

      Swal.fire({
        icon: "error",
        title: "Error al cargar usuarios",
        text: error instanceof Error ? error.message : "Error inesperado al cargar los usuarios",
        confirmButtonColor: "#295d0c",
      });
      
    } finally {
      setLoading(false);
    }
  }, [paginaActual, filtroActual, meta.limit]);

  // Cargar usuarios al montar y cuando isClient sea true
  useEffect(() => {
    if (isClient) {
      fetchUsuarios();
    }
  }, [fetchUsuarios, isClient, paginaActual, filtroActual]);

  // Guardar nuevo usuario
  async function handleSubmitUsuario(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!firmaRef.current || firmaRef.current.isEmpty()) {
        Swal.fire({
          icon: "warning",
          title: "Firma requerida",
          text: "Coloque una firma de ejemplo, luego el usuario podrá modificarla.",
          confirmButtonColor: "#295d0c",
        });

        return;
    }

    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const valorComision = formData.get("comision") as string;
    const comision = valorComision && valorComision.trim() !== "" ? Number(valorComision) : 15;

    const datosUsuario = {
      nombre: formData.get("nombre") as string,
      password: formData.get("password") as string,
      correo: formData.get("correo") as string,
      rol: formData.get("rol") as string,
      zona_asignada: formData.get("zona_asignada") as string,
      comision: comision,
      activo: true,
      telefono: formData.get("telefono") as string,
    };

    try {
      const res = await fetch("/api/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(datosUsuario),
      });

      const data = await res.json();

      if (data.code !== 201) {
        mostrarErroresValidacion(data);
        return;
      }

      const id = data.results[0].id;
      if (firmaRef.current && !firmaRef.current.isEmpty()) {

        const firmaBase64 = firmaRef.current.toDataURL();
        const response = await fetch("/api/firmas/tecnico", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firma_base64: firmaBase64, tecnico_id: id }),
        });

        if (!response.ok) {
          const errorFirma = await response.json();
          throw new Error(errorFirma.message || "Error al guardar la firma");
        }

      }

      Swal.fire({
        icon: "success",
        title: "¡Usuario creado!",
        text: data.message || "Usuario creado correctamente",
        confirmButtonColor: "#295d0c",
      });

      fetchUsuarios();
      setPaginaActual(1);
      setModalOpen(false);

    } catch {      

      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        text:  "No se pudo conectar con el servidor",
        confirmButtonColor: "#295d0c",
      });

    } finally{
      setIsSaving(false);
    }
  }

  // Eliminar usuario
  async function handleEliminarUsuario(id: number) {
    const result = await Swal.fire({
      title: "¿Estás seguro?",
      text: "Esta acción no se puede revertir",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Sí, eliminar",
      cancelButtonText: "Cancelar",
    });

    if (!result.isConfirmed) return;

    try {
      const res = await fetch(`/api/usuarios/${id}`, { method: "DELETE" });
      const data = await res.json();

      if (!res.ok || data.code !== 200) {

        Swal.fire({
          icon: "error",
          title: "Error al eliminar",
          text: data.message || "Error al eliminar usuario",
          confirmButtonColor: "#295d0c",
        });

        return;
      }

      if (usuarios.length === 1 && paginaActual > 1) {
        setPaginaActual(paginaActual - 1);
      } else {
        fetchUsuarios();
      }

      Swal.fire({
        icon: "success",
        title: "¡Usuario eliminado!",
        text: data.message || "Usuario eliminado correctamente",
        confirmButtonColor: "#295d0c",
      });

      fetchUsuarios();

    } catch (error) {

      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        text: "No se pudo conectar con el servidor",
        confirmButtonColor: "#295d0c",
      });

    }
  }

  // Abrir modal para editar usuario
  function abrirEditarUsuario(usuario: Usuario) {
    if (firmaRef.current) {
      firmaRef.current.clear(); 
    }
    
    setUsuarioEditar(usuario);
    setModalOpen(true);
    cargarFirmaDelTecnico(usuario.id);
  }

  // Actualizar usuario
  async function handleEditarCliente(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!usuarioEditar) return;
    setIsSaving(true);

    const formData = new FormData(event.currentTarget);
    const usuarioActualizado: any = {
      nombre: formData.get("nombre") as string,
      password: formData.get("password") as string,
      rol: formData.get("rol") as string,
      zona_asignada: formData.get("zona_asignada") as string,
      telefono: formData.get("telefono") as string,
      activo: formData.get("activo") === "true",
      comision: Number(formData.get("comision")),
      updateAt: new Date().toISOString(),
    };

    const nuevoCorreo = formData.get("correo") as string;
    if (nuevoCorreo !== usuarioEditar.correo) {
      usuarioActualizado.correo = nuevoCorreo;
    }

    try {
      const res = await fetch(`/api/usuarios/${usuarioEditar.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(usuarioActualizado),
      });

      const data = await res.json();

      if (!res.ok || (data.code !== 200 && data.code !== 201)) {
        mostrarErroresValidacion(data);
        return;
      }

      if (firmaRef.current && !firmaRef.current.isEmpty()) {
        const firmaBase64 = firmaRef.current.toDataURL();
        const response = await fetch(`/api/firmas/tecnico/${data.results[0].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ firma_base64: firmaBase64 }),
        });

        if (!response.ok) {
          const errorFirma = await response.json();
          throw new Error(errorFirma.message || "Error al guardar la firma");
        }
      }

      Swal.fire({
        icon: "success",
        title: "¡Usuario actualizado!",
        text: data.message || "Usuario actualizado correctamente",
        confirmButtonColor: "#295d0c",
      });

      fetchUsuarios();
      setModalOpen(false);
      setUsuarioEditar(null);

    } catch {

      Swal.fire({
        icon: "error",
        title: "Error de conexión",
        text: "No se pudo conectar con el servidor",
        confirmButtonColor: "#295d0c",
      });

    } finally{
      setIsSaving(false);
    }
  }

  if (!isClient) return <LoadingSpinner mensaje="Cargando usuarios..." />;
  
  return (
    <div className="w-full p-6 pb-20 min-h-screen bg-gray-50">
      {/* Encabezado */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-gray-800 flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-emerald-700" />
          Gestión de Usuarios
        </h1>
        <div className="border-b border-gray-200"></div>
      </div>

      {/* Búsqueda y botón agregar */}
      <div className="flex flex-col sm:flex-row justify-between items-center mb-6 gap-4">
        <div className="relative flex-grow">
          <input
            type="text"
            placeholder="Buscar por nombre de usuario..."
            value={filtroNombre}
            onChange={(e) => setFiltroNombre(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-transparent transition shadow-sm"
          />
        </div>
        <button
          onClick={() => {
            setUsuarioEditar(null);
            setModalOpen(true);
          }}
          className="px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm hover:bg-emerald-700 transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Agregar Usuario
        </button>
      </div>

      {loading ? (
        <LoadingSpinner mensaje="Cargando usuarios..." />
      ) : usuarios.length === 0 && showEmptyMessage ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8 text-center">
          <div className="text-gray-400 text-6xl mb-4">👥</div>
          <p className="text-gray-600 text-lg">No hay usuarios registrados.</p>
          <p className="text-gray-500 text-sm mt-2">
            Haz clic en "Agregar Usuario" para comenzar.
          </p>
        </div>
      ) : usuarios.length > 0 ? (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <TableHeader>Nombre</TableHeader>
                  <TableHeader className="hidden md:table-cell">Correo</TableHeader>
                  <TableHeader>Rol</TableHeader>
                  <TableHeader className="hidden md:table-cell">Zona</TableHeader>
                  <TableHeader className="hidden md:table-cell">Teléfono</TableHeader>
                  <TableHeader>Comisión</TableHeader>
                  <TableHeader>Activo</TableHeader>
                  <TableHeader>Acciones</TableHeader>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {usuarios.map((usuario) => (
                  <tr key={usuario.id} className="hover:bg-gray-50 transition-colors">
                    <TableCell>{usuario.nombre}</TableCell>
                    <TableCell className="hidden md:table-cell">{usuario.correo}</TableCell>
                    <TableCell>{usuario.rol}</TableCell>
                    <TableCell className="hidden md:table-cell">{usuario.zona_asignada}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      {formatearTelefono(usuario.telefono)}
                    </TableCell>
                    <TableCell>{usuario.comision}%</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        usuario.activo 
                          ? "bg-green-100 text-green-800" 
                          : "bg-red-100 text-red-800"
                      }`}>
                        {usuario.activo ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="justify-center gap-2">
                        <button
                          onClick={() => abrirEditarUsuario(usuario)}
                          className="text-gray-600 hover:text-emerald-600 transition-colors p-1 rounded-full hover:bg-emerald-50"
                          title="Editar usuario"
                        >
                          <Edit3 className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => handleEliminarUsuario(usuario.id)}
                          className="text-gray-600 hover:text-red-600 transition-colors p-1 rounded-full hover:bg-red-50"
                          title="Eliminar usuario"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </div>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
              
              {/* Pie de tabla con paginación */}
              {meta.totalPages > 0 && (
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={8} className="px-6 py-4">
                      <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                        <div className="text-xs text-gray-600">
                          Página {meta.page} de {meta.totalPages} ({meta.total} total)
                        </div>
                        <div className="flex space-x-1">
                          <PaginationButtons
                            currentPage={meta.page}
                            totalPages={meta.totalPages}
                            onPageChange={setPaginaActual}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ) : null}

      {/* Modal para agregar/editar usuario */}
      <ModalUsuario
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setUsuarioEditar(null);
          setFirmaTecnicoImg(null);
          if (firmaRef.current) {
            firmaRef.current.clear();
          }
        }}
      >
        <h2 className="text-xl font-semibold mb-6 text-gray-900">
          {usuarioEditar ? "Editar Usuario" : "Nuevo Usuario"}
        </h2>
        <form
          onSubmit={usuarioEditar ? handleEditarCliente : handleSubmitUsuario}
          className="space-y-4"
        >
          {[
            {
              label: "Nombre",
              name: "nombre",
              type: "text",
              placeholder: "Nombre de usuario",
            },
            {
              label: "Correo",
              name: "correo",
              type: "email",
              placeholder: "Correo electrónico",
            },
            {
              label: "Contraseña",
              name: "password",
              type: "password",
              placeholder: "Contraseña",
            },
            {
              label: "Zona Asignada",
              name: "zona_asignada",
              type: "text",
              placeholder: "Zona asignada",
            },
            {
              label: "Rol",
              name: "rol",
              type: "select",
              options: [
                { label: "Técnico", value: "tecnico" },
                { label: "Administrador", value: "admin" },
              ],
            },
          ].map(({ label, name, type, placeholder, options }) => (
            <label key={name} className="block mb-4 text-gray-800 font-medium text-sm">
              <span className="text-gray-700">{label}:</span>

              {type === "select" ? (
                <select
                  name={name}
                  defaultValue={
                    usuarioEditar ? (usuarioEditar as any)[name] : "tecnico"
                  }
                  required
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#295d0c]"
                >
                  {options?.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={name}
                  type={type}
                  placeholder={placeholder}
                  defaultValue={
                    usuarioEditar ? (usuarioEditar as any)[name] : ""
                  }
                  required
                  className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#295d0c]"
                />
              )}
            </label>
          ))}

          <label className="block mb-4 text-gray-800 font-medium text-sm">
            <span className="text-gray-700">Teléfono:</span>
            <input
              name="telefono"
              type="tel"
              placeholder="Número telefónico"
              defaultValue={
                usuarioEditar ? formatearTelefono(usuarioEditar.telefono) : ""
              }
              onChange={manejarCambioTelefono}
              maxLength={9}
              required
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#295d0c]"
            />
          </label>

          <label className="block mb-4 text-gray-800 font-medium text-sm">
            <span className="text-gray-700">Comisión (%):</span>
            <input
              name="comision"
              type="number"
              placeholder="0"
              defaultValue={usuarioEditar ? usuarioEditar.comision || "" : ""}
              min={0}
              max={100}
              step="any"
              required
              className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#295d0c]"
            />
          </label>

          {usuarioEditar && (
            <label className="block mb-4 text-gray-800 font-medium text-sm">
              <span className="text-gray-700">Estado:</span>
              <select
                name="activo"
                defaultValue={usuarioEditar.activo ? "true" : "false"}
                className="mt-1 w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#295d0c]"
              >
                <option value="true">Activo</option>
                <option value="false">Inactivo</option>
              </select>
            </label>
          )}

          <>
            <span className="text-gray-800 font-semibold block mb-2">
              Firma
            </span>
            <div className="flex justify-center mb-2">
              <SignatureCanvas
                ref={firmaRef}
                penColor="black"
                canvasProps={{
                  width: 350,
                  height: 100,
                  className:
                    "border border-gray-300 rounded-md shadow bg-white",
                  style: { width: "350px", height: "100px" },
                }}
              />
            </div>
            <div className="mt-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (firmaRef.current) {
                    firmaRef.current.clear();
                  }
                }}
                className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition flex items-center gap-1"
              >
                <RefreshCw className="w-4 h-4" />
                Limpiar
              </button>
            </div>
          </>

          <div className="mt-6 flex text-sm justify-end space-x-4">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-5 py-2 rounded-md bg-red-700 text-white font-semibold hover:bg-red-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-6 py-2 rounded-md font-semibold transition ${
                isSaving
                  ? "bg-gray-400 text-white cursor-not-allowed"
                  : "bg-[#295d0c] text-white hover:bg-[#23480a]"
              }`}
            >
              {isSaving ? "Guardando..." : usuarioEditar ? "Guardar" : "Guardar"}
            </button>
          </div>
        </form>
      </ModalUsuario>
    </div>
  );
}
