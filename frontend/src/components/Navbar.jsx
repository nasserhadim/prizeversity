import React from 'react';
import { Link, useLocation } from 'react-router-dom';

const Navbar = () => {
  const location = useLocation();

  // Will match /classroom/:id path with all the nested paths ( /bazaar, /groups, /wallet)
  const classroomMatch = location.pathname.match(/^\/classroom\/([^\/]+)/);
  const classroomId = classroomMatch ? classroomMatch[1] : null;
  const insideClassroom = Boolean(classroomId);

  return (
    <nav data-theme='forest' className='fixed top-0 left-0 right-0 z-50 bg-base-100 text-base-content shadow-md px-6 py-4 bg-black bg-opacity-20 backdrop-blur-md'>
      <div className='container mx-auto flex items-center justify-between'>
        <div className='text-2xl font-bold'>
          <Link to='/'>Prizeversity</Link>
          <></>
        </div>
        <ul className='flex space-x-6 text-lg mr-5'>
          {!insideClassroom && (
            <>
              <li>
                <Link
                  to='/'
                  className={`hover:text-gray-300 ${location.pathname === '/' ? 'text-green-500' : ''}`}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to='/classrooms'
                  className={`hover:text-gray-300 ${location.pathname === '/classrooms' ? 'text-green-500' : ''}`}
                >
                  Classrooms
                </Link>
              </li>
            </>
          )}
          {insideClassroom && (
            <>
              <li>
                <Link
                  to='/'
                  className={`hover:text-gray-300 ${location.pathname === '/' ? 'text-green-500' : ''}`}
                >
                  Home
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}`}
                  className={`hover:text-gray-300 ${location.pathname === `/classroom/${classroomId}` ? 'text-green-500' : ''}`}
                >
                  Classroom
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/bazaar`}
                  className={`hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/bazaar`) ? 'text-green-500' : ''}`}
                >
                  Bazaar
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/groups`}
                  className={`hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/groups`) ? 'text-green-500' : ''}`}
                >
                  Groups
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/wallet`}
                  className={`hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/wallet`) ? 'text-green-500' : ''}`}
                >
                  Wallet
                </Link>
              </li>
              <li>
                <Link
                  to={`/classroom/${classroomId}/people`}
                  className={`hover:text-gray-300 ${location.pathname.startsWith(`/classroom/${classroomId}/people`) ? 'text-green-500' : ''}`}
                >
                  People
                </Link>
              </li>
            </>
          )}
        </ul>
      </div>
    </nav>
  );
};

export default Navbar;