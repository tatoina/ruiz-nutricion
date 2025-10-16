// src/AdminPage.js
import React, { useEffect, useState } from 'react';
import { getAllUsers } from './utils';
import AdminPanel from './AdminPanel';

export default function AdminPage() {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    getAllUsers().then(setUsers);
  }, []);

  return <AdminPanel users={users} /* otras props */ />;
}
