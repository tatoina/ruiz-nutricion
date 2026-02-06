import firebase_admin
from firebase_admin import credentials, firestore

# Inicializar Firebase
try:
    firebase_admin.get_app()
except ValueError:
    # Intenta usar las credenciales por defecto o las del proyecto
    cred = credentials.ApplicationDefault()
    firebase_admin.initialize_app(cred, {
        'projectId': 'nutricionapp-b7b7d'
    })

db = firestore.client()

# Obtener todos los usuarios
users_ref = db.collection('users')
docs = users_ref.stream()

print("\n📊 LISTADO DE USUARIOS/PACIENTES\n")
print("=" * 80)

count = 0
for doc in docs:
    count += 1
    data = doc.data()
    
    nombre = data.get('nombre', data.get('name', 'SIN NOMBRE'))
    apellidos = data.get('apellidos', data.get('surname', ''))
    email = data.get('email', 'sin email')
    telefono = data.get('telefono', data.get('phone', ''))
    objetivo = data.get('objetivoNutricional', '')
    
    print(f"\n{count}. {nombre} {apellidos}")
    print(f"   📧 Email: {email}")
    if telefono:
        print(f"   📱 Teléfono: {telefono}")
    if objetivo:
        print(f"   🎯 Objetivo: {objetivo}")
    print(f"   🆔 UID: {doc.id}")

print("\n" + "=" * 80)
print(f"\n✅ Total: {count} usuarios/pacientes\n")
