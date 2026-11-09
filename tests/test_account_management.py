def test_profile_update_persists(system):
    c,h,a=system
    r=c.put('/auth/me',headers=h['worker'],json={'first_name':'Олег','last_name':'Мельник'})
    assert r.status_code==200
    assert c.get('/auth/me',headers=h['worker']).json()['first_name']=='Олег'

def test_admin_can_change_role_and_block_user(system):
    c,h,a=system
    data={'email':'worker@sklad.io','first_name':'Олег','last_name':'Мельник','role':'Manager','active':True}
    assert c.put('/users/2',headers=h['admin'],json=data).status_code==200
    assert c.post('/categories',headers=h['worker'],json={'name':'Forbidden'}).status_code==403
    data['active']=False
    assert c.put('/users/2',headers=h['admin'],json=data).status_code==200
    assert c.get('/auth/me',headers=h['worker']).status_code==401

def test_admin_cannot_block_self(system):
    c,h,a=system
    r=c.put('/users/1',headers=h['admin'],json={'email':'admin@sklad.io','first_name':'Admin','last_name':'Test','role':'Admin','active':False})
    assert r.status_code==409
    assert c.get('/auth/me',headers=h['admin']).status_code==200

def test_manager_cannot_manage_users(system):
    c,h,a=system
    assert c.put('/users/2',headers=h['manager'],json={'email':'worker@sklad.io','first_name':'A','last_name':'B','role':'Admin','active':True}).status_code==403

def test_password_change_revokes_all_previous_sessions(system):
    c,h,a=system
    another=c.post('/auth/login',json={'email':'worker@sklad.io','password':'Student123!'}).json()['access_token']
    r=c.post('/auth/password',headers=h['worker'],json={'old_password':'Student123!','new_password':'NewStrong123!'})
    assert r.status_code==204
    assert c.get('/auth/me',headers=h['worker']).status_code==401
    assert c.get('/auth/me',headers={'Authorization':'Bearer '+another}).status_code==401
    assert c.post('/auth/login',json={'email':'worker@sklad.io','password':'NewStrong123!'}).status_code==200

def test_incorrect_old_password_keeps_session(system):
    c,h,a=system
    assert c.post('/auth/password',headers=h['worker'],json={'old_password':'wrong','new_password':'NewStrong123!'}).status_code==400
    assert c.get('/auth/me',headers=h['worker']).status_code==200
