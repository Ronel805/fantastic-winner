import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, Plus, Flame, Shield, Calendar, Trophy, 
  Sun, Moon, Trash2, ArrowRight, Sparkles, AlertCircle, 
  BarChart2, Check, RefreshCw
} from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// הגדרת Supabase (ישתמש במשתני הסביבה ב-Vercel או ירוץ מקומית אם לא הוגדר)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

const CATEGORIES = [
  { id: 'health', name: 'בריאות וכושר', color: 'bg-emerald-500 text-white', border: 'border-emerald-500' },
  { id: 'study', name: 'למידה והתפתחות', color: 'bg-blue-500 text-white', border: 'border-blue-500' },
  { id: 'mindset', name: 'התפתחות אישית', color: 'bg-purple-500 text-white', border: 'border-purple-500' },
  { id: 'lifestyle', name: 'פנאי וסגנון חיים', color: 'bg-amber-500 text-white', border: 'border-amber-500' },
];

export default function App() {
  const [darkMode, setDarkMode] = useState(true);
  const [habits, setHabits] = useState([
    { id: '1', title: 'ריצה של 5 ק"מ', category: 'health', streak: 4, shields: 1 },
    { id: '2', title: 'קריאת 20 עמודים', category: 'study', streak: 7, shields: 1 },
    { id: '3', title: 'מדיטציה יומית', category: 'mindset', streak: 2, shields: 2 },
  ]);
  
  const [logs, setLogs] = useState({}); // { 'habitId_YYYY-MM-DD': true/false }
  const [activeTab, setActiveTab] = useState('today'); // 'today' | 'heatmap' | 'goals'
  const [newTitle, setNewTitle] = useState('');
  const [newCategory, setNewCategory] = useState('health');
  const [showConfetti, setShowConfetti] = useState(false);
  const [loading, setLoading] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  // טעינת נתונים מ-Supabase או LocalStorage
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    if (!supabase) {
      // מצב מקומי בלבד אם אין Supabase מוגדר עדיין
      const savedHabits = localStorage.getItem('fantastic_habits');
      const savedLogs = localStorage.getItem('fantastic_logs');
      if (savedHabits) setHabits(JSON.parse(savedHabits));
      if (savedLogs) setLogs(JSON.parse(savedLogs));
      return;
    }

    setLoading(true);
    try {
      const { data: habitsData, error: habitsErr } = await supabase.from('habits').select('*');
      if (habitsErr) throw habitsErr;
      if (habitsData && habitsData.length > 0) {
        setHabits(habitsData);
      }

      const { data: logsData, error: logsErr } = await supabase.from('habit_logs').select('*');
      if (logsErr) throw logsErr;
      if (logsData) {
        const logsMap = {};
        logsData.forEach(l => {
          logsMap[`${l.habit_id}_${l.date}`] = l.completed;
        });
        setLogs(logsMap);
      }
    } catch (err) {
      console.error('Error fetching from Supabase:', err);
    } finally {
      setLoading(false);
    }
  };

  // שמירה מקומית כגיבוי
  useEffect(() => {
    localStorage.setItem('fantastic_habits', JSON.stringify(habits));
    localStorage.setItem('fantastic_logs', JSON.stringify(logs));
  }, [habits, logs]);

  // סימון הרגל להיום
  const toggleHabit = async (habitId) => {
    const key = `${habitId}_${todayStr}`;
    const currentStatus = !!logs[key];
    const newStatus = !currentStatus;

    const updatedLogs = { ...logs, [key]: newStatus };
    setLogs(updatedLogs);

    // עדכון רצף (Streak)
    setHabits(habits.map(h => {
      if (h.id === habitId) {
        const newStreak = newStatus ? h.streak + 1 : Math.max(0, h.streak - 1);
        return { ...h, streak: newStreak };
      }
      return h;
    }));

    // בדיקה האם כל המשימות הושלמו היום להפעלת קונפטי
    const todayCompletedCount = habits.filter(h => {
      if (h.id === habitId) return newStatus;
      return logs[`${h.id}_${todayStr}`];
    }).length;

    if (todayCompletedCount === habits.length && habits.length > 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 4000);
    }

    // סנכרון עם Supabase אם קיים
    if (supabase) {
      try {
        await supabase.from('habit_logs').upsert({
          habit_id: habitId,
          date: todayStr,
          completed: newStatus
        }, { onConflict: 'habit_id,date' });

        const targetHabit = habits.find(h => h.id === habitId);
        const newStreak = newStatus ? targetHabit.streak + 1 : Math.max(0, targetHabit.streak - 1);
        await supabase.from('habits').update({ streak: newStreak }).eq('id', habitId);
      } catch (err) {
        console.error('Error syncing log:', err);
      }
    }
  };

  // הוספת הרגל חדש
  const addHabit = async (e) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newHabitObj = {
      id: Date.now().toString(),
      title: newTitle.trim(),
      category: newCategory,
      streak: 0,
      shields: 1
    };

    setHabits([...habits, newHabitObj]);
    setNewTitle('');

    if (supabase) {
      try {
        await supabase.from('habits').insert([{
          title: newHabitObj.title,
          category: newHabitObj.category,
          streak: 0,
          shields: 1
        }]);
        fetchData(); // טעינה מחדש לקבלת ה-UUID מהשרת
      } catch (err) {
        console.error('Error adding habit:', err);
      }
    }
  };

  // מחיקת הרגל
  const deleteHabit = async (habitId) => {
    setHabits(habits.filter(h => h.id !== habitId));
    if (supabase) {
      try {
        await supabase.from('habits').delete().eq('id', habitId);
      } catch (err) {
        console.error('Error deleting habit:', err);
      }
    }
  };

  // שימוש במגן רצף
  const useShield = (habitId) => {
    setHabits(habits.map(h => {
      if (h.id === habitId && h.shields > 0) {
        return { ...h, shields: h.shields - 1, streak: h.streak + 1 };
      }
      return h;
    }));
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 pb-12 transition-colors duration-300">
      
      {/* אנימציית קונפטי לחגיגת סיום כל המשימות */}
      {showConfetti && (
        <div className="fixed inset-0 pointer-events-none z-50 flex items-center justify-center">
          <div className="bg-gradient-to-r from-amber-500 to-rose-500 text-white px-8 py-4 rounded-2xl shadow-2xl text-2xl font-black animate-bounce flex items-center gap-3">
            <Trophy className="w-8 h-8 text-yellow-200 animate-spin" />
            כל הכבוד! סיימת את כל משימות היום כמו מנצחת! 🎉
          </div>
        </div>
      )}

      {/* Header */}
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 shadow-sm">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-indigo-600 p-2.5 rounded-2xl text-white shadow-lg shadow-indigo-500/30">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-indigo-500 to-violet-600 bg-clip-text text-transparent">
                Fantastic Winner
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400">המרחב האישי שלך לשיפור והתפתחות</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={() => setDarkMode(!darkMode)}
              className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition"
              title="החלף מצב תצוגה"
            >
              {darkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-indigo-600" />}
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-4xl mx-auto px-4 flex gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-2 pb-2">
          <button 
            onClick={() => setActiveTab('today')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${activeTab === 'today' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <CheckCircle className="w-4 h-4" /> מעקב יומי
          </button>
          <button 
            onClick={() => setActiveTab('heatmap')}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${activeTab === 'heatmap' ? 'bg-indigo-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
          >
            <BarChart2 className="w-4 h-4" /> מפת חום ועקביות
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 mt-6">
        
        {/* טאב 1: מעקב יומי */}
        {activeTab === 'today' && (
          <div className="space-y-6">
            
            {/* טופס הוספה מהירה */}
            <form onSubmit={addHabit} className="bg-white dark:bg-slate-900 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row gap-3">
              <input 
                type="text" 
                placeholder="הוסיפי הרגל או משימה חדשה להיום..." 
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              />
              <select 
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-3 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:text-white"
              >
                {CATEGORIES.map(cat => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
              <button 
                type="submit"
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium px-6 py-3 rounded-xl text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" /> הוסף הרגל
              </button>
            </form>

            {/* רשימת המשימות */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-1">
                המשימות להיום ({new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' })})
              </h2>

              {habits.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800">
                  <AlertCircle className="w-12 h-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-slate-600 dark:text-slate-400 font-medium">אין עדיין הרגלים ברשימה.</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">הוסיפי את ההרגל הראשון שלך למעלה כדי להתחיל לנצח את היום!</p>
                </div>
              ) : (
                habits.map(habit => {
                  const isCompleted = !!logs[`${habit.id}_${todayStr}`];
                  const categoryInfo = CATEGORIES.find(c => c.id === habit.category) || CATEGORIES[0];

                  return (
                    <div 
                      key={habit.id}
                      className={`p-4 rounded-2xl border transition-all flex items-center justify-between bg-white dark:bg-slate-900 ${isCompleted ? 'border-emerald-500/50 bg-emerald-50/20 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-800'}`}
                    >
                      <div className="flex items-center gap-4">
                        <button 
                          onClick={() => toggleHabit(habit.id)}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all ${isCompleted ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' : 'border-2 border-slate-300 dark:border-slate-700 hover:border-indigo-500'}`}
                        >
                          {isCompleted && <Check className="w-4 h-4 stroke-[3]" />}
                        </button>

                        <div>
                          <span className={`font-semibold text-base block ${isCompleted ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-800 dark:text-slate-100'}`}>
                            {habit.title}
                          </span>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${categoryInfo.color}`}>
                              {categoryInfo.name}
                            </span>
                            <span className="text-xs text-amber-500 flex items-center gap-1 font-bold">
                              <Flame className="w-3.5 h-3.5 fill-amber-500" /> {habit.streak} ימי רצף
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {habit.shields > 0 && (
                          <button 
                            onClick={() => useShield(habit.id)}
                            title="השתמש במגן רצף"
                            className="text-xs bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 px-2.5 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 flex items-center gap-1 hover:bg-indigo-100 transition"
                          >
                            <Shield className="w-3.5 h-3.5 fill-indigo-500 text-indigo-500" /> ({habit.shields})
                          </button>
                        )}
                        <button 
                          onClick={() => deleteHabit(habit.id)}
                          className="p-2 text-slate-400 hover:text-rose-500 dark:hover:text-rose-400 transition rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
                          title="מחק הרגל"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

          </div>
        )}

        {/* טאב 2: מפת חום ועקביות */}
        {activeTab === 'heatmap' && (
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-6">
            <div>
              <h2 className="text-lg font-bold">מפת עקביות חודשית</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">מעקב ויזואלי אחר ההתמדה שלך לאורך זמן</p>
            </div>

            <div className="grid grid-cols-7 gap-2 pt-4">
              {Array.from({ length: 28 }).map((_, i) => {
                const randomActive = Math.random() > 0.3;
                return (
                  <div 
                    key={i} 
                    className={`h-12 rounded-xl flex flex-col items-center justify-center text-xs font-bold transition ${randomActive ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/30' : 'bg-slate-100 dark:bg-slate-800 text-slate-400'}`}
                  >
                    <span>{i + 1}</span>
                    <span className="text-[9px] opacity-75">{randomActive ? '✓' : '•'}</span>
                  </div>
                );
              })}
            </div>
            <div className="text-center pt-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">💡 טיפ: שמירה על רצף יומי של לפחות 80% מובילה להטמעת הרגלים עמוקה!</span>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
