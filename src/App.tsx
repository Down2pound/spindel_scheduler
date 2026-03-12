import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LayoutDashboard, 
  Calendar, 
  Users, 
  Settings, 
  LogOut, 
  RefreshCw,
  X,
  Link as LinkIcon,
  AlertCircle,
  Sparkles,
  History,
  Terminal,
  GripVertical,
  ArrowRight
} from 'lucide-react';
import { db, auth, signIn, signOut, OperationType, handleFirestoreError } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, collection, addDoc, query, orderBy, limit, where, getDocs, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { fetchSheetData, SheetDaySchedule, SheetAssignment } from './services/sheetService';
import { DOCTORS } from './constants/doctors';
import { TECHNICIANS } from './constants/technicians';
import { GeminiPanel } from './components/GeminiPanel';
import { processScheduleCommand, ScheduleAction } from './services/geminiService';
import { format, subDays } from 'date-fns';

// Dnd Kit
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  defaultDropAnimationSideEffects,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Types ---
const THEMES = [
  { id: 'dark', label: 'Vitreous Dark', color: '#05070a' },
  { id: 'light', label: 'Clinical Light', color: '#f8fafc' },
  { id: 'midnight', label: 'Midnight Blue', color: '#020617' },
  { id: 'forest', label: 'Forest Green', color: '#022c22' },
];

const LOCATIONS = [
  { id: 'Derry', code: 'D', color: '#ff4d4d', targetTechs: 8 },
  { id: 'Londonderry', code: 'LD', color: '#4d94ff', targetTechs: 2 },
  { id: 'Windham', code: 'W', color: '#4dff88', targetTechs: 4 },
  { id: 'Bedford', code: 'B', color: '#ff4db8', targetTechs: 2 },
  { id: 'Raymond', code: 'R', color: '#b84dff', targetTechs: 2 },
  { id: 'Surgery', code: 'S', color: '#f59e0b', targetTechs: 0 },
  { id: 'Off', code: 'OFF', color: '#64748b', targetTechs: 0 },
  { id: 'Admin', code: 'ADM', color: '#94a3b8', targetTechs: 0 },
  { id: 'Floating', code: 'FL', color: '#94a3b8', targetTechs: 0 },
];

// --- Dnd Components ---
const SortableTechnician = ({ id, assignment, isAdmin, onClick, isDragging }: any) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id, disabled: !isAdmin });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative"
    >
      <button
        onClick={onClick}
        {...attributes}
        {...listeners}
        className={`px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[0.6rem] font-bold text-white/60 transition-all flex items-center gap-1.5 ${isAdmin ? 'hover:bg-white/10 cursor-grab active:cursor-grabbing' : 'cursor-default'}`}
      >
        {isAdmin && <GripVertical className="w-2.5 h-2.5 opacity-20 group-hover:opacity-100 transition-opacity" />}
        {assignment.person} {assignment.status && <span className="opacity-40 ml-1">[{assignment.status}]</span>}
      </button>
    </div>
  );
};

const DroppableLocation = ({ id, children, className }: any) => {
  const { setNodeRef, isOver } = useSortable({ id });
  
  return (
    <div 
      ref={setNodeRef} 
      className={`${className} ${isOver ? 'ring-2 ring-blue-500/50 bg-blue-500/5' : ''}`}
    >
      {children}
    </div>
  );
};

const WEEKS = [
  { id: 'current', label: 'Current Week', gid: '0' },
  { id: 'week2', label: '3/9 - 3/14', gid: '11223344' }, // Placeholder GIDs
  { id: 'week3', label: '3/16 - 3/21', gid: '55667788' },
  { id: 'saturdays', label: 'Saturdays', gid: '99001122' },
];

const INITIAL_WEEK_DATA: SheetDaySchedule[] = [
  {
    date: '03/09',
    dayName: 'Monday',
    locations: {
      'Derry': [
        { person: 'MG', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'SW', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'DS', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'LT', role: 'Technician', startTime: '7:15a', endTime: '4:15p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'CV', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'HB', role: 'Technician', startTime: '8:00a', endTime: '3:30p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'MC', role: 'Technician', startTime: '12:30p', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'SG', role: 'Technician', startTime: '9:00a', endTime: '5:30p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'CS', role: 'Technician', startTime: '7:45a', endTime: '3:00p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'MA', role: 'Technician', startTime: '12:30p', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' }
      ],
      'Londonderry': [
        { person: 'BN', role: 'Doctor', startTime: '', endTime: '', location: 'Londonderry', isDoctor: true, status: '' },
        { person: 'JC', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Londonderry', isDoctor: false, status: 'LD' },
        { person: 'MJ', role: 'Technician', startTime: '8:00a', endTime: '5:00p', location: 'Londonderry', isDoctor: false, status: 'LD' }
      ],
      'Windham': [
        { person: 'DV', role: 'Doctor', startTime: '', endTime: '', location: 'Windham', isDoctor: true, status: '' },
        { person: 'JO', role: 'Doctor', startTime: '', endTime: '', location: 'Windham', isDoctor: true, status: '' },
        { person: 'DJ', role: 'Technician', startTime: '7:15a', endTime: '4:45p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'DSJ', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'AB', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'JJ', role: 'Technician', startTime: '7:30a', endTime: '2:30p', location: 'Windham', isDoctor: false, status: 'W' }
      ],
      'Bedford': [
        { person: 'JN', role: 'Doctor', startTime: '', endTime: '', location: 'Bedford', isDoctor: true, status: '' },
        { person: 'AP', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Bedford', isDoctor: false, status: 'B' },
        { person: 'TB', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Bedford', isDoctor: false, status: 'B' }
      ],
      'Raymond': [
        { person: 'NL', role: 'Doctor', startTime: '', endTime: '', location: 'Raymond', isDoctor: true, status: '' },
        { person: 'ML', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Raymond', isDoctor: false, status: 'R' },
        { person: 'SC', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Raymond', isDoctor: false, status: 'R' }
      ],
      'Surgery': [
        { person: 'DS', role: 'Doctor', startTime: '', endTime: '', location: 'Surgery', isDoctor: true, status: '' }
      ],
      'Off': [
        { person: 'GS', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' },
        { person: 'MF', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' }
      ],
      'Floating': [
        { person: 'NC', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'OUT' },
        { person: 'HR', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'OUT' },
        { person: 'KM', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'BIO' },
        { person: 'GW', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'VF' }
      ]
    },
    notes: 'SW 515 | JO last pt @ 2pm'
  },
  {
    date: '03/10',
    dayName: 'Tuesday',
    locations: {
      'Derry': [
        { person: 'DS', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'MG', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'SW', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'LT', role: 'Technician', startTime: '7:15a', endTime: '4:15p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'JC', role: 'Technician', startTime: '12:30p', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'HR', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'MC', role: 'Technician', startTime: '7:15a', endTime: '7:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'MJ', role: 'Technician', startTime: '8:00a', endTime: '7:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'AP', role: 'Technician', startTime: '12:30p', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'ML', role: 'Technician', startTime: '12:30p', endTime: '6:00p', location: 'Derry', isDoctor: false, status: 'D' }
      ],
      'Windham': [
        { person: 'DV', role: 'Doctor', startTime: '', endTime: '', location: 'Windham', isDoctor: true, status: '' },
        { person: 'JO', role: 'Doctor', startTime: '', endTime: '', location: 'Windham', isDoctor: true, status: '' },
        { person: 'CV', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'AB', role: 'Technician', startTime: '7:15a', endTime: '3:00p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'JJ', role: 'Technician', startTime: '7:30a', endTime: '4:45p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'SC', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Windham', isDoctor: false, status: 'W' }
      ],
      'Bedford': [
        { person: 'JN', role: 'Doctor', startTime: '', endTime: '', location: 'Bedford', isDoctor: true, status: '' },
        { person: 'HB', role: 'Technician', startTime: '8:00a', endTime: '4:45p', location: 'Bedford', isDoctor: false, status: 'B' },
        { person: 'MA', role: 'Technician', startTime: '7:30a', endTime: '7:45p', location: 'Bedford', isDoctor: false, status: 'B' },
        { person: 'CS', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Bedford', isDoctor: false, status: 'B' },
        { person: 'BM', role: 'Technician', startTime: '8:30a', endTime: '4:45p', location: 'Bedford', isDoctor: false, status: 'B' }
      ],
      'Raymond': [
        { person: 'NL', role: 'Doctor', startTime: '', endTime: '', location: 'Raymond', isDoctor: true, status: '' },
        { person: 'SG', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Raymond', isDoctor: false, status: 'R' },
        { person: 'TB', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Raymond', isDoctor: false, status: 'R' }
      ],
      'Surgery': [
        { person: 'MG', role: 'Doctor', startTime: '', endTime: '', location: 'Surgery', isDoctor: true, status: '' },
        { person: 'DV', role: 'Doctor', startTime: '', endTime: '', location: 'Surgery', isDoctor: true, status: '' }
      ],
      'Off': [
        { person: 'GS', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' },
        { person: 'MF', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' },
        { person: 'BN', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' }
      ],
      'Floating': [
        { person: 'DJ', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'LASIK' },
        { person: 'CG', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'LASIK' },
        { person: 'KM', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'LASIK' },
        { person: 'NC', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'OUT' },
        { person: 'DSJ', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'LASIK' },
        { person: 'GW', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'VF' }
      ]
    },
    notes: 'SW JN late night | DV return after Lasik'
  },
  {
    date: '03/11',
    dayName: 'Wednesday',
    locations: {
      'Derry': [
        { person: 'GS', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'DR', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'LT', role: 'Technician', startTime: '7:15a', endTime: '4:15p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'JC', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'HR', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'SG', role: 'Technician', startTime: '7:45a', endTime: '2:00p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'TB', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'LB', role: 'Technician', startTime: '7:45a', endTime: '12:30p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'CG', role: 'Technician', startTime: '3:00p', endTime: '', location: 'Derry', isDoctor: false, status: 'GS' }
      ],
      'Londonderry': [
        { person: 'BN', role: 'Doctor', startTime: '', endTime: '', location: 'Londonderry', isDoctor: true, status: '' },
        { person: 'MA', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Londonderry', isDoctor: false, status: 'LD' },
        { person: 'CS', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Londonderry', isDoctor: false, status: 'LD' },
        { person: 'BM', role: 'Technician', startTime: '8:30a', endTime: '4:45p', location: 'Londonderry', isDoctor: false, status: 'LD' }
      ],
      'Windham': [
        { person: 'JO', role: 'Doctor', startTime: '', endTime: '', location: 'Windham', isDoctor: true, status: '' },
        { person: 'JJ', role: 'Technician', startTime: '7:45a', endTime: '7:45p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'ML', role: 'Technician', startTime: '7:45a', endTime: '7:45p', location: 'Windham', isDoctor: false, status: 'W' }
      ],
      'Bedford': [
        { person: 'JN', role: 'Doctor', startTime: '', endTime: '', location: 'Bedford', isDoctor: true, status: '' },
        { person: 'MC', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Bedford', isDoctor: false, status: 'B' },
        { person: 'AP', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Bedford', isDoctor: false, status: 'B' }
      ],
      'Raymond': [
        { person: 'DV', role: 'Doctor', startTime: '', endTime: '', location: 'Raymond', isDoctor: true, status: '' },
        { person: 'NL', role: 'Doctor', startTime: '', endTime: '', location: 'Raymond', isDoctor: true, status: '' },
        { person: 'DJ', role: 'Technician', startTime: '7:15a', endTime: '4:30p', location: 'Raymond', isDoctor: false, status: 'R' },
        { person: 'AB', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Raymond', isDoctor: false, status: 'R' },
        { person: 'HB', role: 'Technician', startTime: '8:00a', endTime: '4:45p', location: 'Raymond', isDoctor: false, status: 'R' }
      ],
      'Surgery': [
        { person: 'MG', role: 'Doctor', startTime: '', endTime: '', location: 'Surgery', isDoctor: true, status: '' },
        { person: 'DS', role: 'Doctor', startTime: '', endTime: '', location: 'Surgery', isDoctor: true, status: '' }
      ],
      'Off': [
        { person: 'MF', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' },
        { person: 'SW', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' }
      ],
      'Floating': [
        { person: 'NC', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'OUT' },
        { person: 'GW', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'VF' }
      ]
    },
    notes: 'JO late night'
  },
  {
    date: '03/12',
    dayName: 'Thursday',
    locations: {
      'Derry': [
        { person: 'GS', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'MG', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'SW', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'CV', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'MA', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'JJ', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'SG', role: 'Technician', startTime: '9:00a', endTime: '5:00p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'CS', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'BM', role: 'Technician', startTime: '8:30a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' }
      ],
      'Londonderry': [
        { person: 'BN', role: 'Doctor', startTime: '', endTime: '', location: 'Londonderry', isDoctor: true, status: '' },
        { person: 'JC', role: 'Technician', startTime: '7:45a', endTime: '7:45p', location: 'Londonderry', isDoctor: false, status: 'LD' },
        { person: 'AP', role: 'Technician', startTime: '7:45a', endTime: '7:45p', location: 'Londonderry', isDoctor: false, status: 'LD' }
      ],
      'Windham': [
        { person: 'JO', role: 'Doctor', startTime: '', endTime: '', location: 'Windham', isDoctor: true, status: '' },
        { person: 'HR', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'TB', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Windham', isDoctor: false, status: 'W' }
      ],
      'Bedford': [
        { person: 'JN', role: 'Doctor', startTime: '', endTime: '', location: 'Bedford', isDoctor: true, status: '' },
        { person: 'MC', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Bedford', isDoctor: false, status: 'B' },
        { person: 'ML', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Bedford', isDoctor: false, status: 'B' }
      ],
      'Raymond': [
        { person: 'NL', role: 'Doctor', startTime: '', endTime: '', location: 'Raymond', isDoctor: true, status: '' },
        { person: 'AB', role: 'Technician', startTime: '7:30a', endTime: '7:45p', location: 'Raymond', isDoctor: false, status: 'R' },
        { person: 'HB', role: 'Technician', startTime: '7:45a', endTime: '7:45p', location: 'Raymond', isDoctor: false, status: 'R' }
      ],
      'Surgery': [
        { person: 'DV', role: 'Doctor', startTime: '', endTime: '', location: 'Surgery', isDoctor: true, status: '' },
        { person: 'DS', role: 'Doctor', startTime: '', endTime: '', location: 'Surgery', isDoctor: true, status: '' }
      ],
      'Off': [
        { person: 'MF', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' }
      ],
      'Floating': [
        { person: 'DJ', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'ADMIN' },
        { person: 'CG', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'PREOPS' },
        { person: 'LT', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'REQ' },
        { person: 'KM', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'BIO' },
        { person: 'NC', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'OUT' },
        { person: 'DSJ', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'DR' },
        { person: 'GW', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'OCT' }
      ]
    },
    notes: 'BN NL late night'
  },
  {
    date: '03/13',
    dayName: 'Friday',
    locations: {
      'Derry': [
        { person: 'SW', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'KM', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'MJ', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'MA', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'CS', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'BM', role: 'Technician', startTime: '8:30a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'D' }
      ],
      'Londonderry': [
        { person: 'MG', role: 'Doctor', startTime: '', endTime: '', location: 'Londonderry', isDoctor: true, status: '' },
        { person: 'BN', role: 'Doctor', startTime: '', endTime: '', location: 'Londonderry', isDoctor: true, status: '' },
        { person: 'JC', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Londonderry', isDoctor: false, status: 'LD' },
        { person: 'HR', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Londonderry', isDoctor: false, status: 'LD' },
        { person: 'AP', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Londonderry', isDoctor: false, status: 'LD' }
      ],
      'Windham': [
        { person: 'DV', role: 'Doctor', startTime: '', endTime: '', location: 'Windham', isDoctor: true, status: '' },
        { person: 'JO', role: 'Doctor', startTime: '', endTime: '', location: 'Windham', isDoctor: true, status: '' },
        { person: 'CV', role: 'Technician', startTime: '7:30a', endTime: '4:45p', location: 'Windham', isDoctor: false, status: 'W' },
        { person: 'AB', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Windham', isDoctor: false, status: 'W' }
      ],
      'Bedford': [
        { person: 'JN', role: 'Doctor', startTime: '', endTime: '', location: 'Bedford', isDoctor: true, status: '' },
        { person: 'MC', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Bedford', isDoctor: false, status: 'B' },
        { person: 'ML', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Bedford', isDoctor: false, status: 'B' }
      ],
      'Raymond': [
        { person: 'NL', role: 'Doctor', startTime: '', endTime: '', location: 'Raymond', isDoctor: true, status: '' },
        { person: 'HB', role: 'Technician', startTime: '7:45a', endTime: '4:45p', location: 'Raymond', isDoctor: false, status: 'R' },
        { person: 'SG', role: 'Technician', startTime: '7:30a', endTime: '4:30p', location: 'Raymond', isDoctor: false, status: 'R' }
      ],
      'Surgery': [
        { person: 'DS', role: 'Doctor', startTime: '', endTime: '', location: 'Surgery', isDoctor: true, status: '' }
      ],
      'Off': [
        { person: 'GS', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' },
        { person: 'MF', role: 'Doctor', startTime: '', endTime: '', location: 'Off', isDoctor: true, status: '' }
      ],
      'Floating': [
        { person: 'DJ', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'OFF' },
        { person: 'CG', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'PREOPS' },
        { person: 'LT', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'REQ' },
        { person: 'NC', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'OUT' },
        { person: 'GW', role: 'Technician', startTime: '', endTime: '', location: 'Floating', isDoctor: false, status: 'VF' }
      ]
    },
    notes: 'SERUM TEARS'
  },
  {
    date: '03/14',
    dayName: 'Saturday',
    locations: {
      'Derry': [
        { person: 'SW', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'BN', role: 'Doctor', startTime: '', endTime: '', location: 'Derry', isDoctor: true, status: '' },
        { person: 'MJ', role: 'Technician', startTime: '7:45a', endTime: '3:00p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'JJ', role: 'Technician', startTime: '7:45a', endTime: '3:00p', location: 'Derry', isDoctor: false, status: 'D' },
        { person: 'DJ', role: 'Technician', startTime: '7:15a', endTime: '4:45p', location: 'Derry', isDoctor: false, status: 'W' }
      ]
    },
    notes: ''
  }
];

interface StaffCardProps {
  assignment: SheetAssignment;
  loc: any;
  getValidationIssues: any;
  isFullRefracting: any;
  onEdit: () => void;
  key?: string | number;
}

function StaffCard({ assignment, loc, getValidationIssues, isFullRefracting, onEdit }: StaffCardProps) {
  return (
    <motion.div 
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onEdit}
      className="group relative bg-white/[0.03] backdrop-blur-xl border border-white/10 p-4 rounded-2xl hover:bg-white/[0.07] transition-all cursor-pointer overflow-hidden shadow-lg"
    >
      {/* Glow Effect */}
      <div 
        className="absolute -left-20 -top-20 w-40 h-40 opacity-0 group-hover:opacity-20 transition-opacity duration-500 blur-3xl pointer-events-none"
        style={{ backgroundColor: loc.color }}
      />
      
      <div 
        className="absolute left-0 top-0 bottom-0 w-[3px] opacity-30 group-hover:opacity-100 transition-all duration-300"
        style={{ backgroundColor: loc.color, boxShadow: `0 0 20px ${loc.color}` }}
      />
      
      <div className="flex justify-between items-start mb-3">
        <div className="space-y-0.5">
          <span 
            className="font-mono font-bold text-lg tracking-tight block"
            style={{ color: assignment.person === 'JC' && assignment.isDoctor ? '#ff4d4d' : 'inherit' }}
          >
            {assignment.person}
            {isFullRefracting(assignment.person) && (
              <span className="ml-2 inline-block w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" title="Full Refracting" />
            )}
          </span>
          <span className="text-[0.5rem] uppercase tracking-[0.2em] text-white/30 font-bold">
            {assignment.role}
          </span>
        </div>
        <div 
          className={`px-2 py-0.5 rounded-lg text-[0.45rem] font-bold border ${assignment.isDoctor ? 'bg-white text-black border-white' : 'bg-white/5 text-white/40 border-white/10'}`}
        >
          {assignment.isDoctor ? 'MD_SURGEON' : 'CLINIC_TECH'}
        </div>
      </div>

      {getValidationIssues(assignment, loc.id).length > 0 && (
        <div className="mb-3 p-2 bg-red-500/10 border border-red-500/20 rounded-lg space-y-1">
          {getValidationIssues(assignment, loc.id).map((issue: string, i: number) => (
            <div key={i} className="flex items-center gap-2 text-[0.5rem] text-red-400 font-mono">
              <AlertCircle className="w-2.5 h-2.5" />
              <span>{issue}</span>
            </div>
          ))}
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2 text-[0.6rem] font-mono text-white/60">
          <RefreshCw className="w-2.5 h-2.5 opacity-30" />
          <span>{assignment.startTime} {assignment.endTime && `→ ${assignment.endTime}`}</span>
        </div>
        
        {assignment.status && (
          <div className="flex items-center gap-1.5 px-2 py-0.5 bg-white/5 rounded-lg border border-white/5">
            <div className="w-1 h-1 rounded-full bg-white/40 animate-pulse" />
            <span className="text-[0.45rem] font-bold text-white/60 uppercase tracking-widest">
              {assignment.status}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EditAssignmentModal({ assignment, onClose, onSave }: { 
  assignment: SheetAssignment; 
  onClose: () => void; 
  onSave: (updated: SheetAssignment | null) => void;
}) {
  const [edited, setEdited] = useState(assignment);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/90 backdrop-blur-xl"
      />
      <motion.div 
        initial={{ opacity: 0, scale: 0.9, y: 30 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 30 }}
        className="relative w-full max-w-md bg-[#0a0c10] border border-white/10 rounded-[2.5rem] p-10 shadow-2xl"
      >
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xl font-bold">Edit Assignment: {assignment.person}</h2>
          <button 
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 hover:bg-red-500/10 text-red-400 rounded-lg transition-colors"
            title="Delete Assignment"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {showDeleteConfirm ? (
          <div className="space-y-6 py-4">
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-center">
              <p className="text-sm font-mono text-red-400">Are you sure you want to delete this assignment?</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-sm font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => onSave(null)}
                className="flex-1 bg-red-500 text-white py-4 rounded-2xl text-sm font-bold transition-all"
              >
                Delete
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[0.6rem] uppercase tracking-widest text-white/40 font-bold">Person ID</label>
              <input 
                type="text" 
                value={edited.person}
                onChange={(e) => setEdited({ ...edited, person: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.6rem] uppercase tracking-widest text-white/40 font-bold">Role</label>
              <select 
                value={edited.isDoctor ? 'Doctor' : 'Technician'}
                onChange={(e) => setEdited({ ...edited, isDoctor: e.target.value === 'Doctor', role: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:border-white/30"
              >
                <option value="Doctor" className="bg-[#0a0c10]">Doctor</option>
                <option value="Technician" className="bg-[#0a0c10]">Technician</option>
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-[0.6rem] uppercase tracking-widest text-white/40 font-bold">Start Time</label>
              <input 
                type="text" 
                value={edited.startTime}
                onChange={(e) => setEdited({ ...edited, startTime: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.6rem] uppercase tracking-widest text-white/40 font-bold">End Time</label>
              <input 
                type="text" 
                value={edited.endTime}
                onChange={(e) => setEdited({ ...edited, endTime: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:border-white/30"
              />
            </div>
            <div className="space-y-2">
              <label className="text-[0.6rem] uppercase tracking-widest text-white/40 font-bold">Status / Location Override</label>
              <input 
                type="text" 
                value={edited.status}
                onChange={(e) => setEdited({ ...edited, status: e.target.value })}
                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-sm font-mono focus:outline-none focus:border-white/30"
              />
            </div>
            
            <div className="pt-4 flex gap-4">
              <button 
                onClick={onClose}
                className="flex-1 bg-white/5 hover:bg-white/10 py-4 rounded-2xl text-sm font-bold transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={() => onSave(edited)}
                className="flex-1 bg-white text-black py-4 rounded-2xl text-sm font-bold transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

import { initializeConstraints, subscribeToDoctors, subscribeToTechnicians, updateDoctorConstraint, updateTechConstraint } from "./services/constraintService";
import { Doctor } from "./constants/doctors";
import { Technician } from "./constants/technicians";

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'admin' | 'technician'>('technician');
  const [selectedTech, setSelectedTech] = useState<string>('');
  const [schedule, setSchedule] = useState<SheetDaySchedule>(INITIAL_WEEK_DATA[0]);
  const [allSchedules, setAllSchedules] = useState<SheetDaySchedule[]>(INITIAL_WEEK_DATA);
  const [doctors, setDoctors] = useState<Record<string, Doctor>>({});
  const [technicians, setTechnicians] = useState<Record<string, Technician>>({});
  const [selectedDayIdx, setSelectedDayIdx] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sheetUrl, setSheetUrl] = useState(localStorage.getItem('sheetUrl') || 'https://docs.google.com/spreadsheets/d/10MTeD3grwqFyr4Odug3VQAih-8115_YVYlBNne2HzA0/edit?usp=sharing');
  const [weekGids, setWeekGids] = useState<Record<string, string>>(() => {
    const saved = localStorage.getItem('weekGids');
    return saved ? JSON.parse(saved) : { current: '0', week2: '', week3: '', saturdays: '' };
  });
  const [selectedWeek, setSelectedWeek] = useState(WEEKS[0]);
  const [error, setError] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [editingAssignment, setEditingAssignment] = useState<{ assignment: SheetAssignment, locationId: string, index: number } | null>(null);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'dark');
  const [showGemini, setShowGemini] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [isProcessingCommand, setIsProcessingCommand] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<SheetAssignment | null>(null);

  const isAdmin = viewMode === 'admin';

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    initializeConstraints();
    const unsubDoctors = subscribeToDoctors(setDoctors);
    const unsubTechs = subscribeToTechnicians(setTechnicians);
    return () => {
      unsubDoctors();
      unsubTechs();
    };
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        // Default to admin if it's the specific admin email, otherwise technician
        if (u.email === 'jefchapin@gmail.com') {
          setViewMode('admin');
        } else {
          setViewMode('technician');
        }
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user || !isAdmin) return;
    
    const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newLogs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(newLogs);
    });

    // Cleanup logs older than 5 days
    const cleanupLogs = async () => {
      const fiveDaysAgo = subDays(new Date(), 5);
      const oldLogsQuery = query(collection(db, 'audit_logs'), where('timestamp', '<', Timestamp.fromDate(fiveDaysAgo)));
      const oldLogs = await getDocs(oldLogsQuery);
      oldLogs.forEach(async (logDoc) => {
        await deleteDoc(doc(db, 'audit_logs', logDoc.id));
      });
    };
    cleanupLogs();

    return unsubscribe;
  }, [user, isAdmin]);

  const addLog = async (action: string, description: string, details: any = {}) => {
    if (!user) return;
    try {
      await addDoc(collection(db, 'audit_logs'), {
        timestamp: serverTimestamp(),
        userEmail: user.email,
        action,
        description,
        details
      });
    } catch (err) {
      console.error('Failed to add log:', err);
    }
  };

  const executeCommand = async () => {
    if (!commandInput.trim() || isProcessingCommand) return;
    
    setIsProcessingCommand(true);
    try {
      const result: ScheduleAction = await processScheduleCommand(commandInput, schedule, doctors, technicians);
      
      if (result.action === 'UNKNOWN') {
        setError(`Could not interpret command: ${result.reasoning}`);
        return;
      }

      const newSchedule = { ...schedule };
      let description = '';

      if (result.action === 'MOVE') {
        const fromLoc = result.fromLocation || 'Floating';
        const toLoc = result.toLocation || 'Floating';
        const personIdx = newSchedule.locations[fromLoc]?.findIndex(a => a.person === result.person);
        
        if (personIdx !== -1) {
          const [assignment] = newSchedule.locations[fromLoc].splice(personIdx, 1);
          assignment.location = toLoc;
          if (!newSchedule.locations[toLoc]) newSchedule.locations[toLoc] = [];
          newSchedule.locations[toLoc].push(assignment);
          description = `Moved ${result.person} from ${fromLoc} to ${toLoc}`;
        } else {
          throw new Error(`Person ${result.person} not found in ${fromLoc}`);
        }
      } else if (result.action === 'UPDATE_TIME') {
        const loc = result.fromLocation || Object.keys(newSchedule.locations).find(l => newSchedule.locations[l].some(a => a.person === result.person));
        if (loc) {
          const assignment = newSchedule.locations[loc].find(a => a.person === result.person);
          if (assignment) {
            if (result.startTime) assignment.startTime = result.startTime;
            if (result.endTime) assignment.endTime = result.endTime;
            description = `Updated times for ${result.person} in ${loc}`;
          }
        }
      } else if (result.action === 'UPDATE_CONSTRAINT' && result.constraintUpdate) {
        const { type, id, updates } = result.constraintUpdate;
        if (type === 'DOCTOR') {
          await updateDoctorConstraint(id, updates);
          description = `Updated constraints for Doctor ${id}`;
        } else if (type === 'TECHNICIAN') {
          await updateTechConstraint(id, updates);
          description = `Updated constraints for Technician ${id}`;
        }
      }

      if (description) {
        if (result.action !== 'UPDATE_CONSTRAINT') {
          const scheduleId = `${selectedWeek.id}_${schedule.dayName}`;
          await setDoc(doc(db, 'schedules', scheduleId), newSchedule);
        }
        await addLog('AI_COMMAND', description, { command: commandInput, result });
        setCommandInput('');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to process AI command.');
    } finally {
      setIsProcessingCommand(false);
    }
  };

  // Dnd Handlers
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const [locId, dIdx, aIdx] = (active.id as string).split('|');
    const assignment = allSchedules[parseInt(dIdx)].locations[locId][parseInt(aIdx)];
    setActiveId(active.id as string);
    setActiveAssignment(assignment);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const [fromLoc, fromDayIdx, fromAssIdx] = (active.id as string).split('|');
      const [toLoc, toDayIdx] = (over.id as string).split('|');
      
      if (fromDayIdx === toDayIdx) {
        const dIdx = parseInt(fromDayIdx);
        const aIdx = parseInt(fromAssIdx);
        const newAllSchedules = [...allSchedules];
        const daySchedule = { ...newAllSchedules[dIdx] };
        
        const [assignment] = daySchedule.locations[fromLoc].splice(aIdx, 1);
        assignment.location = toLoc;
        if (!daySchedule.locations[toLoc]) daySchedule.locations[toLoc] = [];
        daySchedule.locations[toLoc].push(assignment);
        
        newAllSchedules[dIdx] = daySchedule;
        setAllSchedules(newAllSchedules);
        
        const scheduleId = `${selectedWeek.id}_${daySchedule.dayName}`;
        await setDoc(doc(db, 'schedules', scheduleId), daySchedule);
        await addLog('DRAG_DROP', `Moved ${assignment.person} from ${fromLoc} to ${toLoc} on ${daySchedule.dayName}`);
      }
    }
    
    setActiveId(null);
    setActiveAssignment(null);
  };

  useEffect(() => {
    if (user && sheetUrl) {
      handleSync();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    
    const scheduleId = `${selectedWeek.id}_${schedule.dayName}`;
    const unsubscribe = onSnapshot(doc(db, 'schedules', scheduleId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as SheetDaySchedule;
        setSchedule(data);
      }
    });
    
    return unsubscribe;
  }, [user, selectedWeek.id, schedule.dayName]);

  const handleSync = async () => {
    if (!sheetUrl) {
      setShowSettings(true);
      return;
    }
    
    setIsSyncing(true);
    setError(null);
    try {
      const gid = weekGids[selectedWeek.id] || selectedWeek.gid;
      const data = await fetchSheetData(sheetUrl, gid);
      if (data.length > 0) {
        setAllSchedules(data);
        // Auto-select today if possible
        const today = new Date().getDay(); // 0 is Sunday, 1 is Monday
        const dayIdx = today === 0 ? 0 : today - 1; // Map Sunday to Monday for now or just 0
        setSelectedDayIdx(Math.min(dayIdx, data.length - 1));
        setSchedule(data[Math.min(dayIdx, data.length - 1)]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to sync with Google Sheet. Ensure it is published to the web as CSV.');
    } finally {
      setTimeout(() => setIsSyncing(false), 1000);
    }
  };

  useEffect(() => {
    if (allSchedules[selectedDayIdx]) {
      setSchedule(allSchedules[selectedDayIdx]);
    }
  }, [selectedDayIdx, allSchedules]);

  useEffect(() => {
    handleSync();
  }, [selectedWeek]);

  const getStaffingStats = (locationId: string) => {
    const assignments = schedule.locations[locationId] || [];
    const doctors = assignments.filter(a => a.isDoctor).length;
    const techs = assignments.filter(a => !a.isDoctor).length;
    const ratio = doctors > 0 ? (techs / doctors).toFixed(1) : '0';
    const isHealthy = doctors === 0 || parseFloat(ratio) >= 3;
    return { doctors, techs, ratio, isHealthy };
  };

  const saveSettings = () => {
    localStorage.setItem('sheetUrl', sheetUrl);
    localStorage.setItem('weekGids', JSON.stringify(weekGids));
    setShowSettings(false);
    handleSync();
  };

  const updateAssignment = async (updated: SheetAssignment | null) => {
    if (!editingAssignment) return;
    
    const newSchedule = { ...schedule };
    const locAssignments = [...(newSchedule.locations[editingAssignment.locationId] || [])];
    
    if (updated === null) {
      // Deleting
      locAssignments.splice(editingAssignment.index, 1);
    } else if (editingAssignment.index === -1) {
      // Adding new
      locAssignments.push(updated);
    } else {
      locAssignments[editingAssignment.index] = updated;
    }
    
    newSchedule.locations[editingAssignment.locationId] = locAssignments;
    
    const scheduleId = `${selectedWeek.id}_${schedule.dayName}`;
    try {
      await setDoc(doc(db, 'schedules', scheduleId), newSchedule);
      setEditingAssignment(null);
    } catch (err) {
      console.error(err);
      setError('Failed to save changes to database.');
    }
  };

  const addStaff = (locationId: string) => {
    const newAssignment: SheetAssignment = {
      person: 'NEW',
      role: 'Technician',
      startTime: '08:00',
      endTime: '17:00',
      location: locationId,
      isDoctor: false,
      status: ''
    };
    setEditingAssignment({ assignment: newAssignment, locationId, index: -1 });
  };

  const jumpToToday = () => {
    const today = new Date().getDay();
    const dayIdx = today === 0 ? 0 : today - 1;
    setSelectedDayIdx(Math.min(dayIdx, allSchedules.length - 1));
  };

  const filteredAssignments = (locationId: string) => {
    const assignments = schedule.locations[locationId] || [];
    if (!searchQuery) return assignments;
    return assignments.filter(a => 
      a.person.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (a.status && a.status.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const getValidationIssues = (assignment: SheetAssignment, locationId: string) => {
    const issues: string[] = [];
    const loc = LOCATIONS.find(l => l.id === locationId);
    const locCode = loc?.code || '';
    const id = assignment.person;
    const dayName = schedule.dayName;

    if (assignment.isDoctor) {
      const doc = doctors[id];
      if (doc) {
        // Prohibited Locations
        if (doc.prohibitedLocations?.includes(locCode)) {
          issues.push(`${id} is prohibited from ${locationId}`);
        }
        // Fixed Schedule
        if (doc.fixedSchedule && (doc.fixedSchedule.day !== dayName || doc.fixedSchedule.location !== locCode)) {
          issues.push(`${id} fixed schedule is ${doc.fixedSchedule.day} in ${doc.fixedSchedule.location}`);
        }
        // Paired With
        if (doc.pairedWith) {
          const pairedTechs = doc.pairedWith;
          const currentStaff = (schedule.locations[locationId] || []).filter(a => !a.isDoctor);
          const currentTechsAndAliases = currentStaff.flatMap(a => {
            const t = technicians[a.person] || Object.values(technicians).find(tech => tech.aliases?.includes(a.person));
            return [a.person, ...(t?.aliases || [])];
          });
          const missing = pairedTechs.filter(p => !currentTechsAndAliases.includes(p));
          if (missing.length > 0) {
            issues.push(`Missing paired tech(s): ${missing.join(', ')}`);
          }
        }
      }
    } else {
      // Technician logic
      const tech = technicians[id] || Object.values(technicians).find(t => t.aliases?.includes(id));
      if (tech) {
        const currentDoctors = (schedule.locations[locationId] || []).filter(a => a.isDoctor).map(a => a.person);
        
        // Paired With
        if (tech.pairedWith) {
          const pairs = Array.isArray(tech.pairedWith) ? tech.pairedWith : [tech.pairedWith];
          const hasPair = pairs.some(p => currentDoctors.includes(p));
          if (!hasPair) {
            issues.push(`Should be paired with ${pairs.join(' or ')}`);
          }
        }

        // Conditional Pairing
        if (tech.conditionalPairing) {
          const condition = tech.conditionalPairing.find(c => c.day === dayName && c.location === locCode);
          if (condition && !currentDoctors.includes(condition.doctor)) {
            issues.push(`Should be with ${condition.doctor} on ${dayName} in ${locationId}`);
          }
        }

        // Soft Constraints
        if (tech.softConstraints) {
          tech.softConstraints.forEach(sc => {
            if (sc.type === 'avoid_doctor_location' && currentDoctors.includes(sc.doctor)) {
              issues.push(sc.message);
            }
          });
        }
      }
    }
    return issues;
  };

  const isFullRefracting = (id: string) => {
    const tech = technicians[id] || Object.values(technicians).find(t => t.aliases?.includes(id));
    return tech?.fullRefracting || false;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center">
        <div className="relative">
          <RefreshCw className="w-12 h-12 text-[var(--text)] animate-spin opacity-20" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-2 h-2 bg-[var(--text)] rounded-full animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-4 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(30,40,60,0.2)_0%,transparent_70%)]" />
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full bg-[var(--glass)] backdrop-blur-2xl border border-[var(--border)] p-10 rounded-[2.5rem] text-center relative z-10 shadow-2xl"
        >
          <div className="w-20 h-20 bg-[var(--glass)] rounded-3xl flex items-center justify-center mx-auto mb-8 border border-[var(--border)] shadow-inner">
            <LayoutDashboard className="w-10 h-10 text-[var(--text)]" />
          </div>
          <h1 className="text-3xl font-bold text-[var(--text)] mb-3 tracking-tight">Spindel Scheduler</h1>
          <p className="text-[var(--text-muted)] mb-10 text-sm leading-relaxed">Secure access to the Vitreous Clinic Deployment System.</p>
          <button 
            onClick={signIn}
            className="w-full bg-[var(--text)] text-[var(--bg)] font-bold py-4 rounded-2xl hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-3 shadow-[0_0_30px_rgba(255,255,255,0.1)]"
          >
            <Users className="w-5 h-5" />
            Authenticate with Google
          </button>
        </motion.div>
      </div>
    );
  }

  const allTechNames = Array.from(new Set(
    allSchedules.flatMap(day => 
      Object.values(day.locations).flatMap(assignments => 
        (assignments as SheetAssignment[]).filter(a => !a.isDoctor).map(a => a.person)
      )
    )
  )).sort();

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] font-sans selection:bg-white/20">
      {/* Immersive Background */}
      <div className="fixed inset-0 pointer-events-none z-[-1]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(40,60,100,0.15)_0%,transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(100,40,60,0.1)_0%,transparent_50%)]" />
        <div className="absolute inset-0 backdrop-blur-[100px]" />
      </div>
      
      {/* Navigation Rail */}
      <nav className="fixed left-0 top-0 bottom-0 w-24 bg-[var(--nav-bg)] backdrop-blur-3xl border-r border-[var(--border)] flex flex-col items-center py-10 gap-10 z-50">
        <motion.div 
          whileHover={{ scale: 1.05 }}
          className="w-12 h-12 bg-[var(--glass)] rounded-2xl flex items-center justify-center border border-[var(--border)] shadow-lg cursor-pointer"
        >
          <LayoutDashboard className="w-6 h-6" />
        </motion.div>
        
        <div className="flex-1 flex flex-col gap-8">
          <button 
            onClick={() => setViewMode('admin')}
            className={`p-4 rounded-2xl transition-all group relative ${viewMode === 'admin' ? 'text-[var(--text)] bg-[var(--glass)]' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'}`}
          >
            <LayoutDashboard className="w-6 h-6" />
            <div className="absolute left-full ml-4 px-3 py-1 bg-[var(--text)] text-[var(--bg)] text-[0.6rem] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              ADMIN_DASHBOARD
            </div>
          </button>

          <button 
            onClick={() => setViewMode('technician')}
            className={`p-4 rounded-2xl transition-all group relative ${viewMode === 'technician' ? 'text-[var(--text)] bg-[var(--glass)]' : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)]'}`}
          >
            <Calendar className="w-6 h-6" />
            <div className="absolute left-full ml-4 px-3 py-1 bg-[var(--text)] text-[var(--bg)] text-[0.6rem] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              TECH_VIEW
            </div>
          </button>

          {isAdmin && (
            <button 
              onClick={() => setShowSettings(true)}
              className="p-4 text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--glass-hover)] rounded-2xl transition-all group relative"
            >
              <Settings className="w-6 h-6" />
              <div className="absolute left-full ml-4 px-3 py-1 bg-[var(--text)] text-[var(--bg)] text-[0.6rem] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                SYSTEM_SETTINGS
              </div>
            </button>
          )}

          <button 
            onClick={() => setShowGemini(true)}
            className={`p-4 rounded-2xl transition-all group relative ${showGemini ? 'text-emerald-400 bg-emerald-500/10' : 'text-[var(--text-muted)] hover:text-emerald-400 hover:bg-emerald-500/10'}`}
          >
            <Sparkles className="w-6 h-6" />
            <div className="absolute left-full ml-4 px-3 py-1 bg-emerald-500 text-black text-[0.6rem] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
              GEMINI_AI_INSIGHTS
            </div>
          </button>

          {isAdmin && (
            <button 
              onClick={() => setShowLogs(true)}
              className={`p-4 rounded-2xl transition-all group relative ${showLogs ? 'text-blue-400 bg-blue-500/10' : 'text-[var(--text-muted)] hover:text-blue-400 hover:bg-blue-500/10'}`}
            >
              <History className="w-6 h-6" />
              <div className="absolute left-full ml-4 px-3 py-1 bg-blue-500 text-black text-[0.6rem] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap">
                CHANGE_LOGS
              </div>
            </button>
          )}
        </div>

        <button 
          onClick={signOut}
          className="p-4 text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 rounded-2xl transition-all"
        >
          <LogOut className="w-6 h-6" />
        </button>
      </nav>

      {/* Main Viewport */}
      <main className="pl-24 p-8 max-w-[2400px] mx-auto min-h-screen flex flex-col">
        <header className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 bg-[var(--accent-muted)] text-[var(--accent)] text-[0.5rem] font-bold rounded border border-[var(--accent-muted)] tracking-widest uppercase">
                {viewMode === 'admin' ? 'Admin Access' : 'Technician View'}
              </span>
              <span className="text-[0.6rem] font-mono text-[var(--text-muted)] uppercase tracking-[0.3em]">Vitreous_v5.0.0_WEEKLY</span>
            </div>
            <h1 className="text-4xl font-mono font-bold tracking-tighter flex items-baseline gap-4">
              {viewMode === 'admin' ? 'SPINDEL_SCHEDULER' : 'PERSONAL_WEEKLY_SCHEDULE'} 
              <span className="text-[var(--text-muted)] text-xl font-light opacity-20">//</span> 
              <span className="text-[var(--text-muted)]">{selectedWeek.label.toUpperCase()}</span>
            </h1>
            <div className="flex items-center gap-4 text-[var(--text-muted)] font-mono text-xs">
              <button 
                onClick={() => window.open('https://docs.google.com/spreadsheets/d/10MTeD3grwqFyr4Odug3VQAih-8115_YVYlBNne2HzA0/edit?gid=1443435046#gid=1443435046', '_blank')}
                className="flex items-center gap-2 hover:text-[var(--text)] transition-colors"
              >
                <Calendar className="w-3 h-3" /> WEEKLY_OVERVIEW
              </button>
              <span className="w-1 h-1 bg-[var(--border)] rounded-full" />
              <span className="flex items-center gap-2 tracking-widest">{currentTime.toLocaleTimeString([], { hour12: false })}</span>
            </div>
          </div>
          
          <div className="flex flex-col items-end gap-6 w-full md:w-auto">
            <div className="flex items-center gap-4 w-full md:w-auto">
              {viewMode === 'technician' ? (
                <div className="relative flex-1 md:w-64">
                  <select 
                    value={selectedTech}
                    onChange={(e) => setSelectedTech(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-4 pr-10 text-xs font-mono focus:outline-none focus:border-white/30 transition-all appearance-none"
                  >
                    <option value="" className="bg-[#0a0c10]">SELECT_YOUR_NAME...</option>
                    {allTechNames.map(t => (
                      <option key={t} value={t} className="bg-[#0a0c10]">{t}</option>
                    ))}
                  </select>
                  <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20 pointer-events-none" />
                </div>
              ) : (
                <div className="relative flex-1 md:w-64">
                  <input 
                    type="text"
                    placeholder="SEARCH_STAFF..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-2.5 pl-4 pr-10 text-xs font-mono focus:outline-none focus:border-white/30 transition-all"
                  />
                  <Users className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                </div>
              )}
              
              <div className="flex bg-white/5 border border-white/10 rounded-xl p-1 shadow-inner">
                <select 
                  value={selectedWeek.id}
                  onChange={(e) => {
                    const week = WEEKS.find(w => w.id === e.target.value);
                    if (week) setSelectedWeek(week);
                  }}
                  className="bg-transparent text-[0.6rem] font-bold px-3 py-1 focus:outline-none"
                >
                  {WEEKS.map(w => (
                    <option key={w.id} value={w.id} className="bg-[#0a0c10]">{w.label}</option>
                  ))}
                </select>
              </div>

              <button 
                onClick={handleSync}
                disabled={isSyncing}
                className="group flex items-center gap-3 bg-white text-black px-6 py-2.5 rounded-xl text-[0.7rem] font-bold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 shadow-[0_10px_20px_rgba(255,255,255,0.1)]"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : 'group-hover:rotate-180 transition-transform duration-500'}`} />
                {isSyncing ? 'SYNCING_DATA' : 'SYNC_MIRROR'}
              </button>
            </div>
          </div>
        </header>

        {viewMode === 'technician' ? (
          <div className="flex-1">
            {!selectedTech ? (
              <div className="flex flex-col items-center justify-center py-32 text-center space-y-6">
                <div className="w-20 h-20 bg-white/5 rounded-[2.5rem] flex items-center justify-center border border-white/10">
                  <Users className="w-8 h-8 text-white/20" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-bold tracking-tight">Identify Yourself</h2>
                  <p className="text-sm text-white/30 font-mono">Select your name from the dropdown above to view your weekly schedule.</p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
                {allSchedules.map((day, dIdx) => {
                  // Find tech in any location for this day
                  let techAssignment: SheetAssignment | null = null;
                  let techLoc = '';
                  
                  Object.entries(day.locations).forEach(([locId, assignments]) => {
                    const found = (assignments as SheetAssignment[]).find(a => a.person === selectedTech);
                    if (found) {
                      techAssignment = found;
                      techLoc = locId;
                    }
                  });

                  return (
                    <motion.div 
                      key={dIdx}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: dIdx * 0.05 }}
                      className={`bg-white/[0.02] backdrop-blur-3xl border border-white/5 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden ${techAssignment ? 'ring-1 ring-white/10' : 'opacity-40'}`}
                    >
                      <div className="flex justify-between items-start mb-8">
                        <div>
                          <span className="text-[0.5rem] font-black uppercase tracking-[0.3em] text-white/20 block mb-1">{day.dayName}</span>
                          <h3 className="text-2xl font-mono font-bold tracking-tighter">{day.date}</h3>
                        </div>
                        {techAssignment && (
                          <div 
                            className="px-3 py-1 rounded-full text-[0.5rem] font-black uppercase tracking-widest"
                            style={{ backgroundColor: `${LOCATIONS.find(l => l.id === techLoc)?.color}20`, color: LOCATIONS.find(l => l.id === techLoc)?.color, border: `1px solid ${LOCATIONS.find(l => l.id === techLoc)?.color}40` }}
                          >
                            {techLoc}
                          </div>
                        )}
                      </div>

                      {techAssignment ? (
                        <div className="space-y-6">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
                              <Calendar className="w-5 h-5 text-white/40" />
                            </div>
                            <div>
                              <div className="text-[0.5rem] font-black uppercase tracking-widest text-white/20 mb-0.5 flex items-center gap-2">
                                Shift Time
                                {isFullRefracting(techAssignment.person) && (
                                  <span className="flex items-center gap-1 text-[0.4rem] text-emerald-400/60 font-black tracking-widest">
                                    <div className="w-1 h-1 rounded-full bg-emerald-400" />
                                    FULL_REFRACTING
                                  </span>
                                )}
                              </div>
                              <div className="text-lg font-mono font-bold tracking-tight">
                                {techAssignment.startTime || '--'} <span className="text-white/20 mx-1">→</span> {techAssignment.endTime || '--'}
                              </div>
                            </div>
                          </div>

                          {techAssignment.status && (
                            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                              <div className="text-[0.5rem] font-black uppercase tracking-widest text-white/20 mb-2">Status / Notes</div>
                              <div className="text-xs font-mono text-white/60">{techAssignment.status}</div>
                            </div>
                          )}

                          {day.notes && (
                            <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-2xl">
                              <div className="text-[0.5rem] font-black uppercase tracking-widest text-emerald-500/40 mb-2">Clinic Notes</div>
                              <div className="text-[0.65rem] font-mono text-emerald-500/60 leading-relaxed">{day.notes}</div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                          <div className="text-[0.5rem] font-black uppercase tracking-widest text-white/10">Not Scheduled</div>
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <>
            {error && (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-10 bg-red-500/10 border border-red-500/20 p-5 rounded-2xl flex items-center gap-4 text-red-400 text-sm backdrop-blur-xl"
              >
                <AlertCircle className="w-6 h-6" />
                <div className="flex-1">
                  <p className="font-bold uppercase text-[0.6rem] tracking-widest mb-1">Sync Error</p>
                  <p className="opacity-80">{error}</p>
                </div>
                <button onClick={() => setError(null)} className="p-2 hover:bg-white/5 rounded-lg transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}

            {/* Weekly Matrix Grid */}
            {isAdmin && (
              <div className="mb-8 flex items-center gap-4 bg-white/[0.02] border border-white/5 p-4 rounded-3xl">
                <div className="w-10 h-10 bg-emerald-500/20 rounded-xl flex items-center justify-center border border-emerald-500/30">
                  <Terminal className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 relative">
                  <input 
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && executeCommand()}
                    placeholder="ENTER_NATURAL_LANGUAGE_COMMAND (e.g. 'Move LT to Windham on Monday')"
                    className="w-full bg-transparent border-none text-xs font-mono focus:outline-none placeholder:text-white/10"
                    disabled={isProcessingCommand}
                  />
                  {isProcessingCommand && (
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-2">
                      <RefreshCw className="w-3 h-3 text-emerald-400 animate-spin" />
                      <span className="text-[0.5rem] font-mono text-emerald-400 uppercase tracking-widest animate-pulse">Processing...</span>
                    </div>
                  )}
                </div>
                <button 
                  onClick={executeCommand}
                  disabled={!commandInput.trim() || isProcessingCommand}
                  className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[0.6rem] font-black uppercase tracking-widest transition-all disabled:opacity-30"
                >
                  EXECUTE
                </button>
              </div>
            )}
            
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
            >
              <div className="flex-1 overflow-x-auto pb-8">
                <div className="min-w-[1600px] flex flex-col gap-6">
            {/* Days Header */}
            <div className="grid grid-cols-[180px_repeat(6,1fr)] gap-4 sticky top-0 z-20 bg-[#05070a]/80 backdrop-blur-xl py-4 border-b border-white/5">
              <div className="flex items-center justify-center">
                <span className="text-[0.6rem] font-black uppercase tracking-[0.4em] text-white/20">Locations</span>
              </div>
              {['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'].map((day, i) => (
                <div key={day} className="flex flex-col items-center justify-center gap-1">
                  <span className={`text-xs font-black tracking-widest ${selectedDayIdx === i ? 'text-white' : 'text-white/40'}`}>
                    {day}
                  </span>
                  <span className="text-[0.5rem] font-mono text-white/20">
                    {allSchedules[i]?.date || '--/--'}
                  </span>
                </div>
              ))}
            </div>

            {/* Locations Rows */}
            <div className="space-y-4">
              {LOCATIONS.map((loc, lIdx) => {
                const hasAssignmentsAnywhere = allSchedules.some(day => (day.locations[loc.id] || []).length > 0);
                if (loc.id === 'Floating' && !hasAssignmentsAnywhere) return null;

                return (
                  <div key={loc.id} className="grid grid-cols-[180px_repeat(6,1fr)] gap-4 min-h-[120px]">
                    {/* Location Label */}
                    <div className="flex flex-col items-center justify-center bg-white/[0.02] border border-white/5 rounded-3xl p-4 gap-3">
                    <div 
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-lg"
                      style={{ backgroundColor: loc.color, color: '#000' }}
                    >
                      {loc.code || loc.id[0]}
                    </div>
                    <div className="text-center">
                      <h3 className="text-[0.7rem] font-bold tracking-tight">{loc.id.toUpperCase()}</h3>
                      {viewMode === 'admin' && (
                        <button 
                          onClick={() => addStaff(loc.id)}
                          className="mt-2 text-[0.5rem] font-black text-white/20 hover:text-white transition-colors uppercase tracking-widest"
                        >
                          + ADD_STAFF
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Day Cells */}
                  {Array.from({ length: 6 }).map((_, dIdx) => {
                    const daySchedule = allSchedules[dIdx];
                    const assignments = daySchedule?.locations[loc.id] || [];
                    const cellId = `${loc.id}|${dIdx}`;
                    
                    if (loc.id === 'Floating') {
                      // Calculate overstaffed locations
                      const overstaffed = LOCATIONS
                        .filter(l => l.id !== 'Floating' && l.targetTechs > 0)
                        .map(l => {
                          const lAssignments = daySchedule?.locations[l.id] || [];
                          const techCount = lAssignments.filter(a => !a.isDoctor).length;
                          const surplus = techCount - l.targetTechs;
                          return { ...l, surplus };
                        })
                        .filter(l => l.surplus > 0);

                      const activeFloating = assignments.filter(a => {
                        const status = a.status?.toUpperCase();
                        return status !== 'OUT' && status !== 'VF' && status !== 'BIO';
                      });

                      return (
                        <DroppableLocation 
                          key={cellId}
                          id={cellId}
                          className={`bg-white/[0.01] border border-white/5 rounded-3xl p-3 flex flex-col gap-3 transition-all hover:bg-white/[0.03] ${overstaffed.length === 0 && activeFloating.length === 0 ? 'opacity-30' : ''}`}
                        >
                          {overstaffed.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[0.5rem] font-black text-emerald-400 uppercase tracking-widest mb-1">Available to Borrow</div>
                              <div className="flex flex-wrap gap-1.5">
                                {overstaffed.map(l => (
                                  <div 
                                    key={l.id}
                                    className="px-2 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-lg flex items-center gap-2"
                                  >
                                    <span className="text-[0.6rem] font-bold text-emerald-400">{l.id}</span>
                                    <span className="px-1.5 py-0.5 bg-emerald-500 text-black text-[0.5rem] font-black rounded-md">+{l.surplus}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {activeFloating.length > 0 && (
                            <div className="space-y-2">
                              <div className="text-[0.5rem] font-black text-white/20 uppercase tracking-widest mb-1">Floating Assignments</div>
                              <div className="flex flex-wrap gap-1.5">
                                <SortableContext items={activeFloating.map((a, i) => `${loc.id}|${dIdx}|${assignments.indexOf(a)}`)} strategy={verticalListSortingStrategy}>
                                  {activeFloating.map((a, aIdx) => (
                                    <SortableTechnician
                                      key={`${loc.id}|${dIdx}|${assignments.indexOf(a)}`}
                                      id={`${loc.id}|${dIdx}|${assignments.indexOf(a)}`}
                                      assignment={a}
                                      isAdmin={isAdmin}
                                      isDragging={activeId === `${loc.id}|${dIdx}|${assignments.indexOf(a)}`}
                                      onClick={() => viewMode === 'admin' && setEditingAssignment({ assignment: a, locationId: loc.id, index: assignments.indexOf(a) })}
                                    />
                                  ))}
                                </SortableContext>
                              </div>
                            </div>
                          )}

                          {overstaffed.length === 0 && activeFloating.length === 0 && (
                            <div className="flex items-center justify-center h-full">
                              <span className="text-[0.5rem] font-bold text-white/10 uppercase tracking-widest">No Activity</span>
                            </div>
                          )}
                        </DroppableLocation>
                      );
                    }
                    
                    const filtered = assignments.filter(a => 
                      !searchQuery || 
                      a.person.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      (a.status && a.status.toLowerCase().includes(searchQuery.toLowerCase()))
                    );
                    const doctors = filtered.filter(a => a.isDoctor);
                    const techs = filtered.filter(a => !a.isDoctor);

                    return (
                      <DroppableLocation 
                        key={cellId}
                        id={cellId}
                        className={`bg-white/[0.01] border border-white/5 rounded-3xl p-3 flex flex-col gap-3 transition-all hover:bg-white/[0.03] ${assignments.length === 0 ? 'opacity-30' : ''}`}
                      >
                        {/* Doctors */}
                        {doctors.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {doctors.map((a, aIdx) => (
                              <button
                                key={`${a.person}-${aIdx}`}
                                onClick={() => viewMode === 'admin' && setEditingAssignment({ assignment: a, locationId: loc.id, index: assignments.indexOf(a) })}
                                className={`px-2 py-1 bg-white text-black rounded-lg text-[0.6rem] font-black tracking-tighter transition-transform ${viewMode === 'admin' ? 'hover:scale-105' : 'cursor-default'}`}
                                title={`${a.person} (${a.startTime}-${a.endTime}) ${a.status || ''}`}
                              >
                                {a.person}
                              </button>
                            ))}
                          </div>
                        )}
                        
                        {/* Divider if both exist */}
                        {doctors.length > 0 && techs.length > 0 && <div className="h-px bg-white/5 w-full" />}

                        {/* Techs */}
                        {techs.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            <SortableContext items={techs.map((a, i) => `${loc.id}|${dIdx}|${assignments.indexOf(a)}`)} strategy={verticalListSortingStrategy}>
                              {techs.map((a, aIdx) => (
                                <SortableTechnician
                                  key={`${loc.id}|${dIdx}|${assignments.indexOf(a)}`}
                                  id={`${loc.id}|${dIdx}|${assignments.indexOf(a)}`}
                                  assignment={a}
                                  isAdmin={isAdmin}
                                  isDragging={activeId === `${loc.id}|${dIdx}|${assignments.indexOf(a)}`}
                                  onClick={() => viewMode === 'admin' && setEditingAssignment({ assignment: a, locationId: loc.id, index: assignments.indexOf(a) })}
                                />
                              ))}
                            </SortableContext>
                          </div>
                        )}
                      </DroppableLocation>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeAssignment ? (
          <div className="px-3 py-1 bg-white text-black rounded-lg text-[0.6rem] font-black shadow-2xl ring-4 ring-blue-500/20">
            {activeAssignment.person}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  </>
        )}

        {/* Daily Notes Matrix */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
          {allSchedules.map((day, i) => day.notes && (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/[0.02] backdrop-blur-3xl border border-white/5 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full bg-white/10" />
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[0.5rem] font-black uppercase tracking-[0.3em] text-white/20">{day.dayName} NOTES</span>
              </div>
              <p className="text-[0.7rem] font-medium text-white/60 leading-relaxed font-mono">
                {day.notes}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Dynamic Status Bar */}
        <footer className="mt-16 flex justify-between items-center text-[0.6rem] font-mono text-white/20 tracking-[0.2em] uppercase border-t border-white/5 pt-8">
          <div className="flex gap-8">
            <span>LOC_SYNC: {isSyncing ? 'SYNCING' : 'ACTIVE'}</span>
            <span>DATA_FLOW: STABLE</span>
            <span>ENCRYPTION: VITREOUS_v4.2</span>
          </div>
          <div className="flex gap-8">
            <span className="flex items-center gap-2">
              <div className="w-1 h-1 bg-emerald-500 rounded-full animate-pulse" />
              SERVER_LATENCY: 24MS
            </span>
            <span>© 2026 VITREOUS_OPS</span>
          </div>
        </footer>
      </main>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettings(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative w-full max-w-xl bg-[#0a0c10] border border-white/10 rounded-[2.5rem] p-12 shadow-[0_30px_60px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
              
              <div className="flex justify-between items-center mb-10">
                <div>
                  <h2 className="text-2xl font-bold tracking-tight mb-1">System Configuration</h2>
                  <p className="text-xs text-white/30 font-mono uppercase tracking-widest">Core_Settings_v4.2</p>
                </div>
                <button onClick={() => setShowSettings(false)} className="p-3 hover:bg-white/5 rounded-2xl transition-all">
                  <X className="w-6 h-6 text-white/40" />
                </button>
              </div>

              <div className="space-y-10">
                <div className="space-y-4">
                  <label className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40 font-bold block ml-1">Google_Sheet_Source</label>
                  <div className="relative group">
                    <div className="absolute inset-0 bg-white/5 rounded-2xl blur-xl group-focus-within:bg-white/10 transition-all" />
                    <div className="relative">
                      <LinkIcon className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-white/20" />
                      <input 
                        type="text" 
                        value={sheetUrl}
                        onChange={(e) => setSheetUrl(e.target.value)}
                        placeholder="https://docs.google.com/spreadsheets/d/..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-14 pr-6 text-sm font-mono focus:outline-none focus:border-white/30 transition-all placeholder:text-white/10"
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                    <AlertCircle className="w-4 h-4 text-white/20 shrink-0" />
                    <p className="text-[0.65rem] text-white/30 leading-relaxed font-mono">
                      Ensure your Google Sheet is <strong className="text-white/50">Published to the web</strong> (File &gt; Share &gt; Publish to web) as a CSV for the mirror to function correctly.
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40 font-bold block ml-1">Tab_GIDs (Optional)</label>
                  <div className="grid grid-cols-2 gap-4">
                    {WEEKS.map(w => (
                      <div key={w.id} className="space-y-1">
                        <span className="text-[0.5rem] text-white/20 font-mono">{w.label}</span>
                        <input 
                          type="text"
                          value={weekGids[w.id] || ''}
                          onChange={(e) => setWeekGids({ ...weekGids, [w.id]: e.target.value })}
                          placeholder="GID"
                          className="w-full bg-white/5 border border-white/10 rounded-xl py-2 px-3 text-[0.6rem] font-mono focus:outline-none focus:border-white/30"
                        />
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <span className="text-[0.5rem] uppercase tracking-widest text-white/30 font-bold block mb-2">Auto_Refresh</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono">ENABLED</span>
                      <div className="w-8 h-4 bg-emerald-500/20 rounded-full relative">
                        <div className="absolute right-1 top-1 w-2 h-2 bg-emerald-400 rounded-full" />
                      </div>
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl">
                    <span className="text-[0.5rem] uppercase tracking-widest text-white/30 font-bold block mb-2">Staffing_Alerts</span>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-mono">ACTIVE</span>
                      <div className="w-8 h-4 bg-emerald-500/20 rounded-full relative">
                        <div className="absolute right-1 top-1 w-2 h-2 bg-emerald-400 rounded-full" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40 font-bold block ml-1">UI_Theme_Selection</label>
                  <div className="grid grid-cols-2 gap-4">
                    {THEMES.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setTheme(t.id)}
                        className={`p-4 rounded-2xl border transition-all flex flex-col gap-2 ${theme === t.id ? 'bg-white/10 border-white/30' : 'bg-white/5 border-white/5 hover:border-white/10'}`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[0.65rem] font-mono uppercase">{t.label}</span>
                          {theme === t.id && <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                        </div>
                        <div className="flex gap-1">
                          <div className="w-full h-1.5 rounded-full" style={{ backgroundColor: t.color }} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-4">
                  <label className="text-[0.65rem] uppercase tracking-[0.3em] text-white/40 font-bold block ml-1">External_Integration</label>
                  <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.5rem] uppercase tracking-widest text-white/30 font-bold">Embed_URL</span>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText(window.location.origin);
                          alert('Embed URL copied to clipboard!');
                        }}
                        className="text-[0.5rem] px-2 py-1 bg-white/10 hover:bg-white/20 rounded-lg transition-all font-mono"
                      >
                        COPY_LINK
                      </button>
                    </div>
                    <p className="text-[0.6rem] text-white/20 font-mono leading-relaxed">
                      Use this URL in Google Sites "Embed" tool to integrate Spindel Scheduler into your technician website.
                    </p>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={saveSettings}
                    className="w-full bg-white text-black font-bold py-5 rounded-2xl hover:bg-white/90 transition-all active:scale-[0.98] shadow-[0_20px_40px_rgba(255,255,255,0.1)]"
                  >
                    SAVE_CHANGES & REBOOT_SYNC
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
        {editingAssignment && (
          <EditAssignmentModal 
            assignment={editingAssignment.assignment} 
            onClose={() => setEditingAssignment(null)} 
            onSave={updateAssignment} 
          />
        )}
        {showGemini && (
          <GeminiPanel 
            scheduleData={allSchedules} 
            onClose={() => setShowGemini(false)} 
          />
        )}
        {showLogs && (
          <motion.div
            initial={{ opacity: 0, x: 400 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 400 }}
            className="fixed right-0 top-0 bottom-0 w-[450px] bg-[#05070a]/95 backdrop-blur-3xl border-l border-white/10 z-[100] flex flex-col shadow-2xl"
          >
            <div className="p-6 border-b border-white/10 flex items-center justify-between bg-white/5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-xl flex items-center justify-center border border-blue-500/30">
                  <History className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <h2 className="text-sm font-bold tracking-tight text-white">CHANGE_LOGS</h2>
                  <p className="text-[0.6rem] font-mono text-white/40 uppercase tracking-widest">Last 5 Days of Activity</p>
                </div>
              </div>
              <button 
                onClick={() => setShowLogs(false)}
                className="p-2 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {logs.map((log) => (
                <div key={log.id} className="p-4 bg-white/5 border border-white/5 rounded-2xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.5rem] font-mono text-white/20">{log.timestamp?.toDate ? format(log.timestamp.toDate(), 'MMM d, HH:mm') : 'Syncing...'}</span>
                    <span className="text-[0.5rem] font-black uppercase tracking-widest px-2 py-0.5 bg-white/10 rounded">{log.action}</span>
                  </div>
                  <p className="text-xs font-mono text-white/70">{log.description}</p>
                  <p className="text-[0.5rem] font-mono text-white/20 italic">{log.userEmail}</p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Crosshair Cursor & Global Styles */}
      <style>{`
        body {
          cursor: crosshair;
        }
        * {
          scrollbar-width: none;
        }
        *::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
}
