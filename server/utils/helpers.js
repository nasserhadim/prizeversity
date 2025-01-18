export const generateClassCode = (length) => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };
  
  export const getUserRoleInClass = (userId, classroom) => {
    const userObj = classroom.users.find(u => u.userId.toString() === userId.toString());
    return userObj ? userObj.role : null;
  };
  