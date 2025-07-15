import React, { useContext } from 'react'
import { userDataContext } from '../context/UserContext'

function Card({image}) {
      const {serverUrl,userData,setUserData,backendImage,setBackendImage,frontendImage,setFrontendImage,selectedImage,setSelectedImage}=useContext(userDataContext)
  return (
    <div className={`w-[70px] h-[140px] lg:w-[150px] lg:h-[250px] bg-[#020220] border-2 border-[#0000ff66] rounded-2xl overflow-hidden hover:shadow-2xl hover:shadow-blue-950 cursor-pointer hover:border-4 hover:border-white ${selectedImage==image?"border-4 border-white shadow-2xl shadow-blue-950 ":null}`} onClick={()=>{
        setSelectedImage(image)
        setBackendImage(null)
        setFrontendImage(null)
        }}>
      <img src={image} className='h-full object-cover'  />
    </div>
  )
}

export default Card
/*
If you see files without an "M" at the end in version control tools like Git, it usually means those files have not been modified since the last commit. An "M" typically stands for "Modified". If there's no "M", the file is unchanged.
*/
