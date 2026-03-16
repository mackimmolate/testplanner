import { useState } from 'react';

import api from '../api';

function ManagePersonnelModal({ isOpen, onClose, employees, onUpdate }) {
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeNumber, setNewEmployeeNumber] = useState('');

  const handleAdd = async (event) => {
    event.preventDefault();

    const name = newEmployeeName.trim();
    const number = newEmployeeNumber.trim();
    if (!name || !number) {
      return;
    }

    try {
      await api.post('/employees', { name, number });
      setNewEmployeeName('');
      setNewEmployeeNumber('');
      await onUpdate();
    } catch (error) {
      console.error('Kunde inte lägga till person', error);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Ta bort person och historik?')) {
      return;
    }

    try {
      await api.delete(`/employees/${id}`);
      await onUpdate();
    } catch (error) {
      console.error('Kunde inte ta bort person', error);
    }
  };

  if (!isOpen) {
    return null;
  }

  const sortedEmployees = [...employees].sort((left, right) => left.name.localeCompare(right.name));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-800">Personal</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleAdd} className="mb-6 flex items-end gap-4 rounded-md bg-gray-50 p-4">
          <div className="flex-1">
            <label className="mb-1 block text-sm font-medium text-gray-700">Namn</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-2"
              value={newEmployeeName}
              onChange={(event) => setNewEmployeeName(event.target.value)}
              placeholder="Förnamn Efternamn"
            />
          </div>
          <div className="w-32">
            <label className="mb-1 block text-sm font-medium text-gray-700">Nr</label>
            <input
              type="text"
              className="w-full rounded border border-gray-300 p-2"
              value={newEmployeeNumber}
              onChange={(event) => setNewEmployeeNumber(event.target.value)}
              placeholder="123"
            />
          </div>
          <button type="submit" className="rounded bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700">
            Lägg till
          </button>
        </form>

        <div className="space-y-2">
          {sortedEmployees.map((employee) => (
            <div key={employee.id} className="flex items-center justify-between rounded border p-3 hover:bg-gray-50">
              <div>
                <span className="font-bold text-gray-800">{employee.name}</span>
                <span className="ml-2 text-sm text-gray-500">({employee.number})</span>
              </div>
              <button onClick={() => handleDelete(employee.id)} className="text-red-500 hover:text-red-700">
                Ta bort
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ManagePersonnelModal;
