import React from "react";
import Layout from "../Layout"; // tu Layout global
import AdminResizer from "../components/AdminResizer";
import "../components/estilos.css";

/**
 * AdminLayout: wrapper opcional. Úsalo solo si quieres una estructura admin ya montada.
 *
 * Uso:
 * <AdminLayout leftContent={<UsersList/>}>
 *   <UsersDetail />
 * </AdminLayout>
 *
 * Si ya tienes una página admin con .admin-left / .resizer / .admin-right, no es necesario crear este archivo;
 * en su lugar importa AdminResizer y reemplaza la antigua <div className="resizer"> por <AdminResizer />.
 */
export default function AdminLayout({ leftContent, children }) {
  return (
    <Layout>
      <div className="admin-fullscreen">
        <div className="admin-columns">
          <div className="admin-left">
            <div className="admin-left-content">
              {leftContent}
            </div>
          </div>

          <AdminResizer />

          <div className="admin-right">
            {children}
          </div>
        </div>
      </div>
    </Layout>
  );
}