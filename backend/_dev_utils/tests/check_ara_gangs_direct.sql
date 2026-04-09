-- Query langsung semua gang di ARA dari HR_GANGLN
SELECT DISTINCT
    gl.GangCode,
    e.LocCode,
    e.EmpName
FROM HR_GANGLN gl
INNER JOIN HR_EMPLOYEE e ON RTRIM(gl.GangMember) = RTRIM(e.EmpCode)
WHERE e.LocCode = 'ARA'
ORDER BY gl.GangCode
