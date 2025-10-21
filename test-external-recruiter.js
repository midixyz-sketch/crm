// בדיקה: האם המערכת מחזירה את המשרות הנכונות לרכז חיצוני
const { storage } = require('./server/storage');

async function testExternalRecruiter() {
  console.log('\n🧪 בודק מודול רכזים חיצוניים...\n');
  
  const testUserId = '35bde5c2-5979-452e-ac5f-c4908bf75c6c';
  const expectedJobId = '6785eaac-8147-4f40-b2f3-fa72f3c42cfe';
  
  try {
    // בדיקה 1: האם getJobAssignments מחזיר רק משרות פעילות
    console.log('✓ בדיקה 1: getJobAssignments');
    const assignments = await storage.getJobAssignments(testUserId);
    console.log(`  - מצא ${assignments.length} הקצאות`);
    console.log(`  - משרה: ${assignments[0]?.jobId}`);
    
    if (assignments.length !== 1) {
      console.error('❌ שגיאה: צריך למצוא הקצאה אחת בדיוק');
      process.exit(1);
    }
    
    if (assignments[0].jobId !== expectedJobId) {
      console.error('❌ שגיאה: ID משרה לא תואם');
      process.exit(1);
    }
    
    if (!assignments[0].isActive) {
      console.error('❌ שגיאה: ההקצאה צריכה להיות פעילה');
      process.exit(1);
    }
    
    console.log('  ✅ הקצאת משרות עובדת נכון!\n');
    
    // בדיקה 2: getUserById
    console.log('✓ בדיקה 2: getUserById');
    const user = await storage.getUserById(testUserId);
    console.log(`  - משתמש: ${user?.email}`);
    console.log(`  - requiresApproval: ${user?.requiresApproval}`);
    
    if (!user) {
      console.error('❌ שגיאה: לא נמצא משתמש');
      process.exit(1);
    }
    
    if (!user.requiresApproval) {
      console.error('❌ שגיאה: requiresApproval צריך להיות true');
      process.exit(1);
    }
    
    console.log('  ✅ getUserById עובד נכון!\n');
    
    // בדיקה 3: getJobAssignmentsForUser
    console.log('✓ בדיקה 3: getJobAssignmentsForUser');
    const detailedAssignments = await storage.getJobAssignmentsForUser(testUserId);
    console.log(`  - מצא ${detailedAssignments.length} הקצאות מפורטות`);
    
    if (detailedAssignments.length !== 1) {
      console.error('❌ שגיאה: צריך למצוא הקצאה אחת בדיוק');
      process.exit(1);
    }
    
    console.log('  ✅ getJobAssignmentsForUser עובד נכון!\n');
    
    console.log('🎉 כל הבדיקות עברו בהצלחה!\n');
    console.log('📊 סיכום:');
    console.log(`   - רכז חיצוני: ${user.email}`);
    console.log(`   - דורש אישור: ${user.requiresApproval ? 'כן' : 'לא'}`);
    console.log(`   - משרות מוקצות: ${assignments.length}`);
    console.log(`   - עמלה: ${assignments[0].commission || 'לא הוגדרה'}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ שגיאה בבדיקות:', error);
    process.exit(1);
  }
}

testExternalRecruiter();
