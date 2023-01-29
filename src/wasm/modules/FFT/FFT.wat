(module
 (type $FUNCSIG$ii (func (param i32) (result i32)))
 (type $FUNCSIG$vii (func (param i32 i32)))
 (type $FUNCSIG$vidddd (func (param i32 f64 f64 f64 f64)))
 (type $FUNCSIG$i (func (result i32)))
 (import "env" "__divdc3" (func $__divdc3 (param i32 f64 f64 f64 f64)))
 (import "env" "__muldc3" (func $__muldc3 (param i32 f64 f64 f64 f64)))
 (import "env" "cexp" (func $cexp (param i32 i32)))
 (import "env" "free" (func $free (param i32) (result i32)))
 (import "env" "malloc" (func $malloc (param i32) (result i32)))
 (table 0 anyfunc)
 (memory $0 1)
 (export "memory" (memory $0))
 (export "FFT" (func $FFT))
 (func $FFT (; 5 ;) (param $0 i32) (param $1 i32) (result i32)
  (local $2 i32)
  (local $3 i32)
  (local $4 i32)
  (local $5 i32)
  (local $6 i32)
  (local $7 i32)
  (local $8 f64)
  (local $9 i32)
  (local $10 f64)
  (local $11 f64)
  (local $12 f64)
  (local $13 f64)
  (local $14 i32)
  (local $15 i32)
  (local $16 i32)
  (local $17 f64)
  (local $18 f64)
  (local $19 f64)
  (local $20 i32)
  (i32.store offset=4
   (i32.const 0)
   (tee_local $20
    (i32.sub
     (i32.load offset=4
      (i32.const 0)
     )
     (i32.const 96)
    )
   )
  )
  (set_local $2
   (call $malloc
    (i32.shl
     (get_local $1)
     (i32.const 4)
    )
   )
  )
  (block $label$0
   (block $label$1
    (br_if $label$1
     (i32.ne
      (get_local $1)
      (i32.const 1)
     )
    )
    (i64.store offset=8
     (get_local $2)
     (i64.const 0)
    )
    (i64.store
     (get_local $2)
     (i64.load
      (get_local $0)
     )
    )
    (br $label$0)
   )
   (set_local $4
    (call $malloc
     (tee_local $16
      (i32.shl
       (tee_local $3
        (i32.div_s
         (get_local $1)
         (i32.const 2)
        )
       )
       (i32.const 3)
      )
     )
    )
   )
   (set_local $5
    (call $malloc
     (get_local $16)
    )
   )
   (block $label$2
    (br_if $label$2
     (i32.lt_s
      (get_local $1)
      (i32.const 1)
     )
    )
    (set_local $16
     (i32.const 0)
    )
    (loop $label$3
     (i64.store
      (i32.add
       (select
        (get_local $5)
        (get_local $4)
        (tee_local $14
         (i32.and
          (get_local $16)
          (i32.const 1)
         )
        )
       )
       (i32.shl
        (i32.div_s
         (i32.sub
          (get_local $16)
          (get_local $14)
         )
         (i32.const 2)
        )
        (i32.const 3)
       )
      )
      (i64.load
       (get_local $0)
      )
     )
     (set_local $0
      (i32.add
       (get_local $0)
       (i32.const 8)
      )
     )
     (br_if $label$3
      (i32.ne
       (get_local $1)
       (tee_local $16
        (i32.add
         (get_local $16)
         (i32.const 1)
        )
       )
      )
     )
    )
   )
   (set_local $6
    (call $FFT
     (get_local $4)
     (get_local $3)
    )
   )
   (set_local $7
    (call $FFT
     (get_local $5)
     (get_local $3)
    )
   )
   (block $label$4
    (br_if $label$4
     (i32.lt_s
      (get_local $1)
      (i32.const 2)
     )
    )
    (set_local $9
     (i32.add
      (get_local $2)
      (i32.shl
       (get_local $3)
       (i32.const 4)
      )
     )
    )
    (set_local $8
     (f64.convert_s/i32
      (get_local $1)
     )
    )
    (set_local $16
     (i32.const 0)
    )
    (set_local $15
     (i32.add
      (i32.add
       (get_local $20)
       (i32.const 80)
      )
      (i32.const 8)
     )
    )
    (set_local $17
     (f64.const 0)
    )
    (set_local $0
     (i32.const 0)
    )
    (loop $label$5
     (set_local $19
      (f64.add
       (f64.mul
        (get_local $17)
        (f64.const -6.283185307179586)
       )
       (f64.const 0)
      )
     )
     (block $label$6
      (br_if $label$6
       (f64.eq
        (tee_local $18
         (f64.add
          (f64.mul
           (get_local $17)
           (f64.const 0)
          )
          (f64.const 0)
         )
        )
        (get_local $18)
       )
      )
      (br_if $label$6
       (f64.eq
        (get_local $19)
        (get_local $19)
       )
      )
      (call $__muldc3
       (i32.add
        (get_local $20)
        (i32.const 80)
       )
       (f64.const 0)
       (f64.const -6.283185307179586)
       (get_local $17)
       (f64.const 0)
      )
      (set_local $19
       (f64.load
        (get_local $15)
       )
      )
      (set_local $18
       (f64.load offset=80
        (get_local $20)
       )
      )
     )
     (call $__divdc3
      (i32.add
       (get_local $20)
       (i32.const 64)
      )
      (get_local $18)
      (get_local $19)
      (get_local $8)
      (f64.const 0)
     )
     (i64.store
      (tee_local $14
       (i32.add
        (i32.add
         (get_local $20)
         (i32.const 32)
        )
        (i32.const 8)
       )
      )
      (i64.load
       (i32.add
        (i32.add
         (get_local $20)
         (i32.const 64)
        )
        (i32.const 8)
       )
      )
     )
     (i64.store
      (i32.add
       (get_local $20)
       (i32.const 8)
      )
      (i64.load
       (get_local $14)
      )
     )
     (i64.store offset=32
      (get_local $20)
      (i64.load offset=64
       (get_local $20)
      )
     )
     (i64.store
      (get_local $20)
      (i64.load offset=32
       (get_local $20)
      )
     )
     (call $cexp
      (i32.add
       (get_local $20)
       (i32.const 48)
      )
      (get_local $20)
     )
     (set_local $19
      (f64.add
       (f64.mul
        (tee_local $11
         (f64.load
          (i32.add
           (i32.add
            (get_local $20)
            (i32.const 48)
           )
           (i32.const 8)
          )
         )
        )
        (tee_local $12
         (f64.load
          (tee_local $14
           (i32.add
            (get_local $7)
            (get_local $16)
           )
          )
         )
        )
       )
       (f64.mul
        (tee_local $10
         (f64.load offset=48
          (get_local $20)
         )
        )
        (tee_local $13
         (f64.load
          (i32.add
           (get_local $14)
           (i32.const 8)
          )
         )
        )
       )
      )
     )
     (block $label$7
      (br_if $label$7
       (f64.eq
        (tee_local $18
         (f64.sub
          (f64.mul
           (get_local $10)
           (get_local $12)
          )
          (f64.mul
           (get_local $11)
           (get_local $13)
          )
         )
        )
        (get_local $18)
       )
      )
      (br_if $label$7
       (f64.eq
        (get_local $19)
        (get_local $19)
       )
      )
      (call $__muldc3
       (i32.add
        (get_local $20)
        (i32.const 16)
       )
       (get_local $10)
       (get_local $11)
       (get_local $12)
       (get_local $13)
      )
      (set_local $19
       (f64.load
        (i32.add
         (i32.add
          (get_local $20)
          (i32.const 16)
         )
         (i32.const 8)
        )
       )
      )
      (set_local $18
       (f64.load offset=16
        (get_local $20)
       )
      )
     )
     (f64.store
      (tee_local $14
       (i32.add
        (get_local $2)
        (get_local $16)
       )
      )
      (f64.add
       (get_local $18)
       (tee_local $10
        (f64.load
         (tee_local $1
          (i32.add
           (get_local $6)
           (get_local $16)
          )
         )
        )
       )
      )
     )
     (f64.store
      (i32.add
       (get_local $14)
       (i32.const 8)
      )
      (f64.add
       (get_local $19)
       (tee_local $11
        (f64.load
         (i32.add
          (get_local $1)
          (i32.const 8)
         )
        )
       )
      )
     )
     (f64.store
      (tee_local $14
       (i32.add
        (get_local $9)
        (get_local $16)
       )
      )
      (f64.sub
       (get_local $10)
       (get_local $18)
      )
     )
     (f64.store
      (i32.add
       (get_local $14)
       (i32.const 8)
      )
      (f64.sub
       (get_local $11)
       (get_local $19)
      )
     )
     (set_local $16
      (i32.add
       (get_local $16)
       (i32.const 16)
      )
     )
     (set_local $17
      (f64.add
       (get_local $17)
       (f64.const 1)
      )
     )
     (br_if $label$5
      (i32.lt_s
       (tee_local $0
        (i32.add
         (get_local $0)
         (i32.const 1)
        )
       )
       (get_local $3)
      )
     )
    )
   )
   (drop
    (call $free
     (get_local $4)
    )
   )
   (drop
    (call $free
     (get_local $5)
    )
   )
   (drop
    (call $free
     (get_local $6)
    )
   )
   (drop
    (call $free
     (get_local $7)
    )
   )
  )
  (i32.store offset=4
   (i32.const 0)
   (i32.add
    (get_local $20)
    (i32.const 96)
   )
  )
  (get_local $2)
 )
)
