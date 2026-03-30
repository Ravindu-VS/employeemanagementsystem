const fs = require('fs');
const path = 'src/services/advance-service.ts';
let code = fs.readFileSync(path, 'utf8');
code += \nexport async function checkDuplicatePendingAdvance(employeeId: string): Promise<boolean> {
  const { collection, query, where, getDocs, doc, updateDoc, deleteDoc } = require('firebase/firestore');
  const { db } = require('@/lib/firebase/client');
  const q = query(collection(db, 'advances'), where('employeeId', '==', employeeId), where('status', '==', 'pending'));
  const snap = await getDocs(q);
  return !snap.empty;
}

export async function updateAdvanceRequest(advanceId: string, data: any): Promise<void> {
  const { doc, updateDoc } = require('firebase/firestore');
  const { db } = require('@/lib/firebase/client');
  const docRef = doc(db, 'advances', advanceId);
  data.updatedAt = new Date().toISOString();
  await updateDoc(docRef, data);
}

export async function deleteAdvance(advanceId: string): Promise<void> {
  const { doc, deleteDoc } = require('firebase/firestore');
  const { db } = require('@/lib/firebase/client');
  const docRef = doc(db, 'advances', advanceId);
  await deleteDoc(docRef);
}\n;
fs.writeFileSync(path, code);

