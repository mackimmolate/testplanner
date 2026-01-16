import React, { useState } from 'react';
import api from '../api';

function ManagePersonnelModal({ isOpen, onClose, employees, onUpdate }) {
    const [newEmployeeName, setNewEmployeeName] = useState('');
    const [newEmployeeNumber, setNewEmployeeNumber] = useState('');

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newEmployeeName || !newEmployeeNumber) return;

        try {
            await api.post('/employees', {
                name: newEmployeeName,
                number: newEmployeeNumber
            });
            setNewEmployeeName('');
            setNewEmployeeNumber('');
            onUpdate();
        } catch (error) {
            console.error("Error adding employee", error);
        }
    };

    const handleDelete = async (id) => {
        if (!confirm("Är du säker på att du vill ta bort denna person? All historik kan försvinna om den inte sparas externt.")) return;
        try {
            await api.delete(`/employees/${id}`);
            onUpdate();
        } catch (error) {
            console.error("Error deleting employee", error);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-bold text-gray-800">Hantera Personal</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Add Form */}
                <form onSubmit={handleAdd} className="bg-gray-50 p-4 rounded-md mb-6 flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Namn</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded p-2"
                            value={newEmployeeName}
                            onChange={e => setNewEmployeeName(e.target.value)}
                            placeholder="Förnamn Efternamn"
                        />
                    </div>
                    <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Anst.nr</label>
                        <input
                            type="text"
                            className="w-full border border-gray-300 rounded p-2"
                            value={newEmployeeNumber}
                            onChange={e => setNewEmployeeNumber(e.target.value)}
                            placeholder="123"
                        />
                    </div>
                    <button type="submit" className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 font-medium">
                        Lägg till
                    </button>
                </form>

                {/* List */}
                <div className="space-y-2">
                    {employees.sort((a,b) => a.name.localeCompare(b.name)).map(emp => (
                        <div key={emp.id} className="flex justify-between items-center p-3 border rounded hover:bg-gray-50">
                            <div>
                                <span className="font-bold text-gray-800">{emp.name}</span>
                                <span className="text-gray-500 text-sm ml-2">({emp.number})</span>
                            </div>
                            <button onClick={() => handleDelete(emp.id)} className="text-red-500 hover:text-red-700">
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
